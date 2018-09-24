'use strict';

const _ = require('lodash');
const chai = require('chai');
const simple = require('simple-mock');
const nock = require('nock');
const Voxa = require('voxa');

const voxaChatbase = require('../lib/Voxa-Chatbase');
const views = require('./views');

const expect = chai.expect;
const CHATBASE_URL = 'https://chatbase-area120.appspot.com';
const chatbaseConfig = {
  apiKey: 'some_api_key',
};

let voxaStateMachine;

describe('Voxa-Chatbase plugin', () => {
  beforeEach(() => {
    voxaStateMachine = new Voxa({ views });

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

  it('should register ChatbaseAnalytics on LaunchRequest', () => {
    const spy = simple.spy(() => ({ reply: 'LaunchIntent.OpenResponse', to: 'entry' }));
    voxaStateMachine.onIntent('LaunchIntent', spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(spy.called).to.be.true;
        expect(reply.session.new).to.equal(true);
        expect(reply.session.attributes.state).to.equal('entry');
        expect(reply.msg.statements).to.have.lengthOf(1);
        expect(reply.msg.statements[0]).to.equal('Hello! How are you?');
      });
  });

  it('should register ChatbaseAnalytics on IntentRequest', () => {
    const spy = simple.spy(() => ({ reply: 'Question.Ask', to: 'entry' }));
    voxaStateMachine.onIntent('SomeIntent', spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(spy.called).to.be.true;
        expect(reply.session.new).to.equal(false);
        expect(reply.session.attributes.state).to.equal('entry');
        expect(reply.msg.statements).to.have.lengthOf(1);
        expect(reply.msg.statements[0]).to.equal('What time is it?');
      });
  });

  it('should register ChatbaseAnalytics on AMAZON.FallbackIntent and end the session', () => {
    const spy = simple.spy(() => ({ reply: 'ExitIntent.GeneralExit' }));
    voxaStateMachine.onIntent('AMAZON.FallbackIntent', spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(spy.called).to.be.true;
        expect(reply.session.new).to.equal(false);
        expect(reply.session.attributes.state).to.equal('die');
        expect(reply.msg.statements).to.have.lengthOf(1);
        expect(reply.msg.statements[0]).to.equal('Ok. Goodbye.');
      });
  });

  it('should register ChatbaseAnalytics on SessionEndedRequest', () => {
    const spy = simple.spy(() => ({ reply: 'ExitIntent.GeneralExit' }));
    voxaStateMachine.onSessionEnded(spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(spy.called).to.be.true;
        expect(reply.version).to.equal('1.0');
      });
  });

  it('should register ChatbaseAnalytics on unexpected error', () => {
    const intentSpy = simple.spy(() => {
      throw new Error('random error');
    });
    voxaStateMachine.onIntent('ErrorIntent', intentSpy);

    const spy = simple.spy(() => ({ reply: 'BadInput.RepeatLastAskReprompt', to: 'invalid-state' }));
    voxaStateMachine.onError(spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(spy.called).to.be.true;
        expect(reply.reply).to.equal('BadInput.RepeatLastAskReprompt');
        expect(reply.to).to.equal('invalid-state');
        expect(reply.error.toString()).to.equal('Error: random error');
      });
  });

  it('should not record analytics if the user is ignored', () => {
    const spy = simple.spy(() => ({ reply: 'ExitIntent.GeneralExit' }));
    voxaStateMachine.onSessionEnded(spy);

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

    voxaChatbase(voxaStateMachine, ignoreUsersConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(reply.version).to.equal('1.0');
      });
  });

  it('should not record analytics if suppressSending === true', () => {
    const spy = simple.spy(() => ({ reply: 'ExitIntent.GeneralExit' }));
    voxaStateMachine.onSessionEnded(spy);

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

    const suppressSendingConfig = _.cloneDeep(chatbaseConfig);
    suppressSendingConfig.suppressSending = true;

    voxaChatbase(voxaStateMachine, suppressSendingConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(reply.version).to.equal('1.0');
      });
  });
});

describe('Voxa-Chatbase plugin error: all_succeeded flag is not present', () => {
  beforeEach(() => {
    voxaStateMachine = new Voxa({ views });

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

  it('should not record analytics due to Chatbase Error', () => {
    const spy = simple.spy(() => ({ reply: 'ExitIntent.GeneralExit' }));
    voxaStateMachine.onSessionEnded(spy);

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

    voxaChatbase(voxaStateMachine, chatbaseConfig);
    return voxaStateMachine.execute(event)
      .then((reply) => {
        expect(reply.version).to.equal('1.0');
      });
  });
});
