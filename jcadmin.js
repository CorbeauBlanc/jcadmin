/*
    jcadmin.js  -  by Don Cross

    https://github.com/cosinekitty/jcadmin
*/

// Configuration...
var port = 9393;
var jcpath = '/home/don/dev/trunk/dontronics/phone/jcblock/';

var fs = require('fs');
var express = require('express');
var app = express();

app.use(express.static('public'));

app.get('/', (request, response) => {
    response.sendFile(__dirname + '/index.html');
});

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

function ParseRecentCalls(text) {
    var lines = text.split('\n');
    var calls = [];
    for (var i=0; i < lines.length; ++i) {
        var c = ParseCallLine(lines[i]);
        if (c) {
            calls.push(c);
        }
    }
    return calls;
}

app.get('/calls', (request, response) => {
    var jcLogFile = jcpath + 'callerID.dat';
    fs.readFile(jcLogFile, 'utf8', (err, data) => {
        var replyJson = { 'calls': ParseRecentCalls(data) };
        response.type('json');
        response.end(JSON.stringify(replyJson));
    });
});

const server = app.listen(port, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log('jcadmin server listening on port %s', port);
});
