/*
    jcadmin.js  -  by Don Cross

    https://github.com/cosinekitty/jcadmin
*/
var path = require('path');
var fs = require('fs');
var express = require('express');
var app = express();
var logprefix = require('log-prefix');

function ZeroPad(n, d) {
    var s = '' + n;
    while (s.length < d) {
        s = '0' + s;
    }
    return s;
}

var DaysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

logprefix(function(){
    var now = new Date();
    var text = '[' + now.getFullYear();
    text += '-' + ZeroPad(now.getMonth() + 1, 2);
    text += '-' + ZeroPad(now.getDate(), 2);
    text += ' ' + ZeroPad(now.getHours(), 2);
    text += ':' + ZeroPad(now.getMinutes(), 2);
    text += ':' + ZeroPad(now.getSeconds(), 2);
    text += '.' + ZeroPad(now.getMilliseconds(), 3);
    text += ' ' + DaysOfWeek[now.getDay()];
    text += '] %s';
    return text;
});

// Parse the command line for configuration parameters.
// Usage:  node jcadmin.js port path
var port = 9393;
var jcpath = '.';

if (process.argv.length > 2) {
    port = parseInt(process.argv[2]);
}

if (process.argv.length > 3) {
    jcpath = process.argv[3];
}

var jcLogFile = ValidateFileExists(path.join(jcpath, 'callerID.dat'));
var whiteListFileName = ValidateFileExists(path.join(jcpath, 'whitelist.dat'));
var blackListFileName = ValidateFileExists(path.join(jcpath, 'blacklist.dat'));
console.log('Monitoring jcblock path %s', jcpath);

app.use(express.static('public'));

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, 'index.html'));
});

function ValidateFileExists(filename) {
    try {
        fs.statSync(filename);
        return filename;
    } catch (e) {
        console.log('FATAL ERROR: file does not exist: %s', filename);
        console.log('Try adjusting the path passed on the command line.');
        process.exit(1);
    }
}

function MakeDateTimeString(date, time) {
    // date = '011916', time = '1623'  ==>  '2016-01-19 16:23'
    var year = (2000 + parseInt(date.substr(4, 2), 10)) + '';
    return year + '-' + date.substr(0, 2) + '-' + date.substr(2, 2) + ' ' + time.substr(0, 2) + ':' + time.substr(2, 2);
}

function FilterNameNumber(text) {
    text = text.trim();
    if (text == "O") {
        return "";
    }
    return text;
}

function ParseCallLine(line) {
    // Examples of caller ID data:
    // B-DATE = 011916--TIME = 1616--NMBR = 8774845967--NAME = TOLL FREE CALLE--
    // --DATE = 011916--TIME = 1623--NMBR = O--NAME = O--
    var m = line.match(/([WB\-])-DATE = (\d{6})--TIME = (\d{4})--NMBR = ([^\-]*)--NAME = ([^\-]*)--/);
    if (m) {
        return {
            'status':   m[1],     // W, B, -; whitelisted, blocked, neither
            'when':     MakeDateTimeString(m[2], m[3]),
            'number':   FilterNameNumber(m[4]),
            'name':     FilterNameNumber(m[5])
        };
    }
    return null;
}

function ParseRecentCalls(text, start, limit) {
    var lines = text.split('\n');
    var calls = [];
    var total = 0;
    for (var i = lines.length - 1; i >= 0; --i) {
        var c = ParseCallLine(lines[i]);
        if (c) {
            if (total >= start && calls.length < limit) {
                calls.push(c);
            }
            ++total;
        }
    }

    return {
        'total': total,
        'start': start,
        'limit': limit,
        'calls': calls
    };
}

function ParseIntParam(text, fallback) {
    var value = parseInt(text);
    if (isNaN(value)) {
        return fallback;
    }
    return value;
}

function EndResponse(response, result) {
    response.type('json');
    response.end(JSON.stringify(result));
}

function FailResponse(response, error) {
    console.log('FailResponse: %s', error);
    EndResponse(response, {'error': error});
}

app.get('/api/poll', (request, response) => {
    // https://nodejs.org/api/fs.html#fs_fs_stat_path_callback
    // https://nodejs.org/api/fs.html#fs_class_fs_stats
    // http://stackoverflow.com/questions/7559555/last-modified-file-date-in-node-js

    var reply = {};

    // Start 3 async requests. The the first one to encounter an error
    // or the last one to succeed ends the response for us.

    function StatCallback(err, stats, reply, field) {
        if (err) {
            EndResponse(response, { 'error':err, 'field':field });
        } else {
            if (!reply.error) {
                reply[field] = { 'modified' : stats.mtime };
                if (reply.callerid && reply.whitelist && reply.blacklist) {
                    EndResponse(response, reply);
                }
            }
        }
    }

    fs.stat(jcLogFile,         (err, stats) => StatCallback(err, stats, reply, 'callerid' ));
    fs.stat(whiteListFileName, (err, stats) => StatCallback(err, stats, reply, 'whitelist'));
    fs.stat(blackListFileName, (err, stats) => StatCallback(err, stats, reply, 'blacklist'));
});

app.get('/api/calls/:start/:limit', (request, response) => {
    var start = ParseIntParam(request.params.start, 0);
    var limit = ParseIntParam(request.params.limit, 1000000000);
    fs.readFile(jcLogFile, 'utf8', (err, data) => {
        if (err) {
            FailResponse(response, err);
        } else {
            EndResponse(response, ParseRecentCalls(data, start, limit));
        }
    });
});

app.get('/api/fetch/:filetype', (request, response) => {
    response.type('json');

    var filename;
    switch (request.params.filetype) {
        case 'whitelist':  filename = whiteListFileName;  break;
        case 'blacklist':  filename = blackListFileName;  break;
        default:
            FailResponse(response, 'Invalid filetype ' + request.params.filetype);
            return;
    }

    fs.readFile(filename, 'utf8', (err, data) => {
        if (err) {
            FailResponse(response, err);
        } else {
            reply = { 'table' : {} };
            var lines = data.split('\n');
            for (var line of lines) {
                var record = ParseRecord(line);
                if (record) {
                    reply.table[record.pattern] = record.comment;
                }
            }
            EndResponse(response, reply);
        }
    });
});

function MakePhoneNumberRecord(phonenumber, comment) {
    if (phonenumber.length > 18) {
        phonenumber = phonenumber.substring(0, 18);
    }
    var record = phonenumber + '?';
    while (record.length < 19) {
        record += ' ';
    }
    if (!comment) {
        comment = '';
    }
    record += '++++++        ' + comment + '\n';
    return record;
}

function ParseRecord(line) {
    if (!line.startsWith('#') && (line.length >= 25)) {
        var limit = line.indexOf('?');
        if (limit < 0) limit = 19;
        var pattern = line.substr(0, limit).trim();
        var comment = line.substr(25).trim();
        return { 'pattern':pattern, 'comment':comment };
    }
    return null;
}

function RemovePhoneNumberFromFile(filename, phonenumber, response, callback) {
    fs.readFile(filename, 'utf8', (err,data) => {
        if (err) {
            FailResponse(response, err);
        } else {
            var lines = data.split('\n');
            var updated = '';
            var numChanges = 0;
            for (var line of lines) {
                var record = ParseRecord(line);
                if (record && record.pattern===phonenumber) {
                    ++numChanges;
                } else {
                    updated += line + '\n';
                }
            }

            if (numChanges > 0) {
                // Write 'updated' back to the file.
                fs.writeFile(filename, updated, 'utf8', (err) => {
                    if (err) {
                        FailResponse(response, err);
                    } else {
                        callback();
                    }
                });
            } else {
                callback();
            }
        }
    });
}

function AddPhoneNumberToFile(filename, phonenumber, comment, response, callback) {
    fs.readFile(filename, 'utf8', (err,data) => {
        if (err) {
            console.log('Error reading from file %s: %s', filename, err);
            FailResponse(response, err);
        } else {
            var lines = data.split('\n');
            for (var line of lines) {
                var record = ParseRecord(line);
                if (record && record.pattern===phonenumber) {
                    callback();
                    return;
                }
            }

            // Append new record to file.
            // Append a new line to the blacklist file.
            var record = MakePhoneNumberRecord(phonenumber);
            fs.appendFile(filename, record, 'utf8', (aerr) => {
                if (aerr) {
                    console.log('Error appending to file %s: %s', filename, aerr);
                    FailResponse(response, aerr);
                } else {
                    callback();
                }
            });
        }
    });
}

app.get('/api/classify/:status/:phonenumber/:comment', (request, response) => {
    var status = request.params.status;
    var phonenumber = request.params.phonenumber;
    var comment = request.params.comment;
    console.log('Classify status=%s, phonenumber=%s, comment=%s', status, phonenumber, comment);

    // For now, only allow exact phone number patterns.
    // This is to prevent damage to whitelist and blacklist files.
    if (!phonenumber.match(/^[0-9]{10}$/)) {
        console.log('Illegal phone number pattern! Failing!');
        FailResponse(response, 'Invalid phone number');
        return;
    }

    switch (status) {
        case 'blocked':
            RemovePhoneNumberFromFile(whiteListFileName, phonenumber, response, function(){
                AddPhoneNumberToFile(blackListFileName, phonenumber, comment, response, function(){
                    EndResponse(response, {'status': 'B'});
                });
            });
            break;

        case 'neutral':
            RemovePhoneNumberFromFile(whiteListFileName, phonenumber, response, function(){
                RemovePhoneNumberFromFile(blackListFileName, phonenumber, response, function(){
                    EndResponse(response, {'status': '-'});
                });
            });
            break;

        case 'safe':
            RemovePhoneNumberFromFile(blackListFileName, phonenumber, response, function(){
                AddPhoneNumberToFile(whiteListFileName, phonenumber, comment, response, function(){
                    EndResponse(response, {'status': 'W'});
                });
            });
            break;

        default:
            console.log('Unknown status! Failing!');
            FailResponse(response, 'Invalid status');
            return;
    }
});

const server = app.listen(port, () => {
    console.log('jcadmin server listening on port %s', port);
});
