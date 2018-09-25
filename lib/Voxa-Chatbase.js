'use strict';

const _ = require('lodash');
const Chatbase = require('@google/chatbase');
const lambdaLog = require('lambda-log');

const defaultConfig = {
  ignoreUsers: [],
  platform: 'Alexa',
};

module.exports = register;

function register(skill, config) {
  const pluginConfig = _.merge({}, defaultConfig, config);

  skill.onBeforeReplySent(track);

  skill.onSessionEnded(async (request, reply, transition) => {
    await track(request, reply, transition, true);
  });

  async function track(request, reply, transition, isSessionEndedRequest) {
    if (_.includes(pluginConfig.ignoreUsers, request.user.userId)) return Promise.resolve(null);
    if (pluginConfig.suppressSending) return Promise.resolve(null);
    if (isSessionEndedRequest && request.request.type !== 'SessionEndedRequest') return Promise.resolve(null);

    lambdaLog.info('Sending to chatbase');

    const messageSet = Chatbase.newMessageSet()
      .setApiKey(pluginConfig.apiKey)
      .setPlatform(pluginConfig.platform)
      .setVersion('1.0');

    // PROCESSING INCOMING RESPONSE
    createUserMessage(messageSet, request, reply);

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
}

function createUserMessage(messageSet, request, reply) {
  const unhandledIntents = ['AMAZON.FallbackIntent', 'Unhandled', 'DefaultFallbackIntent'];
  const intentName = request.intent.name || request.request.type;
  const slots = {};

  _.each(request.intent.slots, (x) => {
    slots[x.name] = x.value;
  });

  const userMessage = request.intent.slots ? JSON.stringify(slots) : '';

  const newMessage = messageSet.newMessage()
    .setCustomSessionId(request.session.sessionId)
    .setTimestamp(Date.now().toString())
    .setUserId(request.user.userId)
    .setAsTypeUser()
    .setMessage(userMessage)
    .setIntent(intentName);

  if (_.includes(unhandledIntents, request.intent.name)) {
    newMessage.setAsNotHandled();
  }
}

function createBotMessage(messageSet, request, reply) {
  const appMessage = reply.msg.statements.join(' ');

  messageSet.newMessage()
    .setCustomSessionId(request.session.sessionId)
    .setTimestamp(Date.now().toString())
    .setUserId(request.user.userId)
    .setAsTypeAgent()
    .setMessage(appMessage);
}
