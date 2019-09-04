'use strict';

const _ = require('lodash');
const { expect } = require('chai');
const simple = require('simple-mock');
const nock = require('nock');
const { VoxaApp, AlexaPlatform } = require('voxa');

const voxaChatbase = require('../lib/Voxa-Chatbase').register;
const views = require('./views');

const CHATBASE_URL = 'https://chatbase-area120.appspot.com';
const chatbaseConfig = {
  apiKey: 'some_api_key',
  platform: 'alexa',
};

let voxaApp;
let alexaSkill;

describe('Voxa-Chatbase plugin', () => {
  beforeEach(() => {
    voxaApp = new VoxaApp({ views });
    alexaSkill = new AlexaPlatform(voxaApp);

    const response = {
      all_succeeded: true,
      status: 200,
    };

    nock(CHATBASE_URL)
      .post('/api/messages')
      .reply(200, JSON.stringify(response));
  });

  afterEach(() => {
    simple.restore();
    nock.cleanAll();
  });

  it('should register ChatbaseAnalytics on LaunchRequest', async () => {
    const spy = simple.spy(() => ({ ask: 'LaunchIntent.OpenResponse', to: 'entry' }));
    voxaApp.onIntent('LaunchIntent', spy);

    const event = {
      request: {
        type: 'LaunchRequest',
      },
      session: {
        new: true,
        sessionId: 'some',
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    delete chatbaseConfig.platform;

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(spy.called).to.be.true;
    expect(reply.response.outputSpeech.ssml).to.contains('Hello! How are you?');
    expect(reply.response.shouldEndSession).to.equal(false);
    expect(reply.sessionAttributes.state).to.equal('entry');
  });

  it('should register ChatbaseAnalytics on IntentRequest', async () => {
    const spy = simple.spy(() => ({ ask: 'Question.Ask', to: 'entry' }));
    voxaApp.onIntent('SomeIntent', spy);

    const event = {
      request: {
        type: 'IntentRequest',
        intent: {
          name: 'SomeIntent',
          slots: {
            param1: {
              name: 'param1',
              value: 'something',
            },
          },
        },
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(spy.called).to.be.true;
    expect(reply.response.outputSpeech.ssml).to.contains('What time is it?');
    expect(reply.response.shouldEndSession).to.equal(false);
    expect(reply.sessionAttributes.state).to.equal('entry');
  });

  it('should register ChatbaseAnalytics on AMAZON.FallbackIntent and end the session', async () => {
    const spy = simple.spy(() => ({ tell: 'ExitIntent.GeneralExit' }));
    voxaApp.onIntent('FallbackIntent', spy);

    const event = {
      request: {
        type: 'IntentRequest',
        intent: {
          name: 'AMAZON.FallbackIntent',
        },
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(spy.called).to.be.true;
    expect(reply.response.outputSpeech.ssml).to.contains('Ok. Goodbye.');
    expect(reply.response.shouldEndSession).to.equal(true);
    expect(reply.sessionAttributes.state).to.equal('die');
  });

  it('should register ChatbaseAnalytics on SessionEndedRequest', async () => {
    const spy = simple.spy(() => ({ tell: 'ExitIntent.GeneralExit' }));
    voxaApp.onSessionEnded(spy);

    const event = {
      request: {
        type: 'SessionEndedRequest',
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(spy.called).to.be.true;
    expect(reply.version).to.equal('1.0');
  });

  it('should register ChatbaseAnalytics on unexpected error', async () => {
    const intentSpy = simple.spy(() => {
      throw new Error('random error');
    });
    voxaApp.onIntent('ErrorIntent', intentSpy);

    const spy = simple.spy(() => ({ say: 'BadInput.RepeatLastAskReprompt.say', to: 'invalid-state' }));
    voxaApp.onError(spy);

    const event = {
      request: {
        type: 'IntentRequest',
        intent: {
          name: 'ErrorIntent',
        },
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(spy.called).to.be.true;
    expect(reply.say).to.equal('BadInput.RepeatLastAskReprompt.say');
    expect(reply.to).to.equal('invalid-state');
  });

  it('should not record analytics if the user is ignored', async () => {
    const spy = simple.spy(() => ({ tell: 'ExitIntent.GeneralExit' }));
    voxaApp.onSessionEnded(spy);

    const event = {
      request: {
        type: 'SessionEndedRequest',
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    const ignoreUsersConfig = _.cloneDeep(chatbaseConfig);
    ignoreUsersConfig.ignoreUsers = ['user-id'];

    voxaChatbase(voxaApp, ignoreUsersConfig);

    const reply = await alexaSkill.execute(event);

    expect(reply.version).to.equal('1.0');
  });

  it('should not record analytics if suppressSending === true', async () => {
    const spy = simple.spy(() => ({ tell: 'ExitIntent.GeneralExit' }));
    voxaApp.onIntent('ErrorIntent', spy);

    const event = {
      request: {
        type: 'IntentRequest',
        intent: {
          name: 'ErrorIntent',
        },
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    const suppressSendingConfig = _.cloneDeep(chatbaseConfig);
    suppressSendingConfig.suppressSending = true;

    voxaChatbase(voxaApp, suppressSendingConfig);

    const reply = await alexaSkill.execute(event);

    expect(reply.version).to.equal('1.0');
  });
});

describe('Voxa-Chatbase plugin error: all_succeeded flag is not present', () => {
  beforeEach(() => {
    voxaApp = new VoxaApp({ views });
    alexaSkill = new AlexaPlatform(voxaApp);

    const response = {
      status: 200,
    };

    nock(CHATBASE_URL)
      .post('/api/messages')
      .reply(200, JSON.stringify(response));
  });

  afterEach(() => {
    simple.restore();
    nock.cleanAll();
  });

  it('should not record analytics due to Chatbase Error', async () => {
    const spy = simple.spy(() => ({ tell: 'ExitIntent.GeneralExit' }));
    voxaApp.onSessionEnded(spy);

    const event = {
      request: {
        type: 'SessionEndedRequest',
      },
      session: {
        new: false,
        application: {
          applicationId: 'appId',
        },
        user: {
          userId: 'user-id',
        },
      },
    };

    voxaChatbase(voxaApp, chatbaseConfig);

    const reply = await alexaSkill.execute(event);

    expect(reply.version).to.equal('1.0');
  });
});
