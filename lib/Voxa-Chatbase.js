'use strict';

const _ = require('lodash');
const Chatbase = require('@google/chatbase');
const lambdaLog = require('lambda-log');

let defaultConfig = {
  ignoreUsers: [],
  platform: 'Alexa',
};

module.exports = register;

function register(skill, config) {
  defaultConfig = _.merge({}, defaultConfig, config);

  skill.onBeforeReplySent(track);

  skill.onSessionEnded(async (request, reply, transition) => {
    await track(request, reply, transition, true);
  });
}

async function track(request, reply, transition, isSessionEndedRequest) {
  if (_.includes(defaultConfig.ignoreUsers, request.user.userId)) return Promise.resolve(null);
  if (defaultConfig.suppressSending) return Promise.resolve(null);
  if (isSessionEndedRequest && request.request.type !== 'SessionEndedRequest') return Promise.resolve(null);

  lambdaLog.info('Sending to chatbase');

  const messageSet = Chatbase.newMessageSet()
    .setApiKey(defaultConfig.apiKey)
    .setPlatform(defaultConfig.platform)
    .setVersion('1.0');

  // PROCESSING INCOMING RESPONSE
  createUserMessage(messageSet, request);

  // PROCESSING OUTGOING RESPONSE
  createBotMessage(messageSet, request, reply);

  // SENDING ANALYTICS
  try {
    const response = await messageSet.sendMessageSet();
    lambdaLog.info('Response from chatbase', { response });

    return response;
  } catch (err) {
    lambdaLog.error(err);
  }
}

function createUserMessage(messageSet, request) {
  const unhandledIntents = ['AMAZON.FallbackIntent', 'Unhandled', 'DefaultFallbackIntent'];
  const intentName = request.intent.name || request.request.type;
  const slots = {};

  _.each(request.intent.slots, (x) => {
    slots[x.name] = x.value;
  });

  const userMessage = request.intent.slots ? JSON.stringify(slots) : '';

  const newMessage = createMessage(messageSet, request);

  newMessage
    .setAsTypeUser()
    .setMessage(userMessage)
    .setIntent(intentName);

  if (_.includes(unhandledIntents, request.intent.name)) {
    newMessage.setAsNotHandled();
  }
}

function createBotMessage(messageSet, request, reply) {
  const appMessage = reply.msg.statements.join(' ');

  const newMessage = createMessage(messageSet, request);

  newMessage
    .setAsTypeAgent()
    .setMessage(appMessage);
}

function createMessage(messageSet, request) {
  const timestamp = Date.now().toString();

  return messageSet
    .newMessage()
    .setCustomSessionId(request.session.sessionId)
    .setTimestamp(timestamp)
    .setUserId(request.user.userId);
}
