'use strict';

/**
 * Views for tests
 *
 * Copyright (c) 2018 Rain Agency.
 * Licensed under the MIT license.
 */

const views = (function views() {
  return {
    LaunchIntent: {
      OpenResponse: { tell: 'Hello! How are you?' },
    },
    Question: {
      Ask: { ask: 'What time is it?' },
    },
    ExitIntent: {
      GeneralExit: { tell: 'Ok. Goodbye.' },
    },
    BadInput: {
      RepeatLastAskReprompt: { say: 'I\'m sorry. I didn\'t understand.' },
    },
  };
}());

module.exports = views;

