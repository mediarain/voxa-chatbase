Voxa Chatbase for Alexa Skills
==============================

[![Build Status](https://travis-ci.org/mediarain/voxa-chatbase.svg?branch=master)](https://travis-ci.org/mediarain/voxa-chatbase)
[![Coverage Status](https://coveralls.io/repos/github/mediarain/voxa-chatbase/badge.svg?branch=master)](https://coveralls.io/github/mediarain/voxa-chatbase?branch=master)

A [Chatbase](https://www.npmjs.com/package/@google/chatbase) plugin for building Alexa Skills with [voxa](https://mediarain.github.io/voxa/)

Installation
-------------

Just install from [npm](https://www.npmjs.com/package/voxa-chatbase)

```bash
npm install --save voxa-chatbase
```

Usage
------

```javascript

const Voxa = require('voxa');
const voxaChatbase = require('voxa-chatbase');

const skill = new Voxa(voxaOptions);

const chatbaseConfig = {
  apiKey: '<chatbase apiKey>',
  ignoreUsers: [], // a list of users to ignore.
  suppressSending: false, // A flag to supress sending hits.
};

voxaChatbase(skill, chatbaseConfig);
```
