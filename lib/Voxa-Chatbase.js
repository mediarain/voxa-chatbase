'use strict';

const _ = require('lodash');
const Chatbase = require('@google/chatbase');
const lambdaLog = require('lambda-log');

const pluginConfig = {
  ignoreUsers: [],
  platform: 'Alexa',
};

let defaultConfig;

module.exports = register;

function register(skill, config) {
  defaultConfig = _.merge({}, pluginConfig, config);

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
  const unhandledIntents = ['FallbackIntent', 'Unhandled', 'DefaultFallbackIntent'];
  const intentName = request.intent.name || request.request.type;

  const userMessage = request.intent.params ? JSON.stringify(request.intent.params) : '';

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
  let appMessage = _.get(reply, 'response.outputSpeech.ssml', '');
  appMessage = appMessage || _.get(reply, 'response.outputSpeech.text', '');
  appMessage = appMessage.replace('<speak>', '').replace('</speak>', '');

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
