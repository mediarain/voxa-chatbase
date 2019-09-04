Voxa Chatbase for Alexa Skills and Google Actions
=================================================

[![Build Status](https://travis-ci.org/mediarain/voxa-chatbase.svg?branch=master)](https://travis-ci.org/mediarain/voxa-chatbase)
[![Coverage Status](https://coveralls.io/repos/github/mediarain/voxa-chatbase/badge.svg?branch=master)](https://coveralls.io/github/mediarain/voxa-chatbase?branch=master)

A [Chatbase](https://www.npmjs.com/package/@google/chatbase) plugin for building Alexa Skills and Google Actions with [voxa](http://voxa.ai/)

Installation
-------------

Just install from [npm](https://www.npmjs.com/package/voxa-chatbase)

```bash
npm install --save voxa-chatbase
```

Usage
------

```javascript

const { VoxaApp } = require('voxa');
const voxaChatbase = require('voxa-chatbase').register;

const voxaApp = new VoxaApp(voxaOptions);

const chatbaseConfig = {
  platform: '<"Facebook"|"SMS"|"Web"|"Android"|"iOS"|"Actions"|"Alexa"|"Cortana"|"Kik"|"Skype"|"Twitter"|"Viber"|"Telegram"|"Slack"|"WhatsApp"|"WeChat"|"Line"|"Kakao">' \\ or a custom name like "Workplace" or "OurPlatform"
  apiKey: '<chatbase apiKey>',
  ignoreUsers: [], // a list of users to ignore.
  platform: 'alexa', // optional, if not present, it will take the default name from the platform used in Voxa
  suppressSending: false, // A flag to supress sending hits.
};

voxaChatbase(voxaApp, chatbaseConfig);
```
