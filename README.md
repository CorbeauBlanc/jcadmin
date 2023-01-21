| Foreword: |
|:---|
| <br/>This repository is a fork of cosinekitty's jcadmin : https://github.com/cosinekitty/jcadmin <br/><br/> My goal here is to make it a bit prettier and cleaner using bootstrap and modern css, and fixing a few bugs here and there.<br/>I changed as little js as I could (except for the previously mentionned bugs) as the focus was primarily on the style. The screenshots in the README have been updated for the new version.<br/>A french version is also available on the `master-french` branch<br/>Dark-mode is on by default but you can change it by setting `<html data-bs-theme="light">` instead of `dark` in index.html.<br/>But let's be honnest, why would you do that? |


# jcadmin
A web-based interface to administrate Walter S. Heath's [jcblock](http://jcblock.sourceforge.net) junk call blocker program.

Jcadmin is a Node.js server designed to run on the same machine as jcblock.
It provides a browser-based interface that machines on your home network can use to view caller ID and easily block annoying phone calls from telemarketers and scammers.

Jcadmin makes maintaining jcblock much easier, eliminating the need to manually edit files.  It also provides an easy way to see how often and when calls have been received from a given phone number.

## Installation

See the [Installation](https://github.com/cosinekitty/jcadmin/wiki/Installation) wiki page.

## Screen shots

- Home screen displays a list of recent calls.

![Call history](https://github.com/CorbeauBlanc/jcadmin/raw/master/screenshots/jcadmin-home.png "Call history")

- Click on any call to see detailed info about that caller.

![Caller details](https://github.com/CorbeauBlanc/jcadmin/raw/master/screenshots/jcadmin-detail.png "Detail page")

- Sortable phone book shows known callers.

![Phone book](https://github.com/CorbeauBlanc/jcadmin/raw/master/screenshots/jcadmin-phonebook.png "Phone book")
