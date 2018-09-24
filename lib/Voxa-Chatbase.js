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
  skill.onSessionEnded((request, reply, transition) => {
    track(request, reply, transition, true);
  });

  function track(request, reply, transition, isSessionEndedRequest) {
    if (_.includes(pluginConfig.ignoreUsers, request.user.userId)) return Promise.resolve(null);
    if (pluginConfig.suppressSending) return Promise.resolve(null);
    if (isSessionEndedRequest && request.request.type !== 'SessionEndedRequest') return Promise.resolve(null);

    lambdaLog.info('Sending to chatbase');

    const messageSet = Chatbase.newMessageSet()
      .setApiKey(pluginConfig.apiKey)
      .setPlatform(pluginConfig.platform)
      .setVersion('1.0');

    // PROCESSING INCOMING RESPONSE
    createMessage(messageSet, request, reply, true);

    // PROCESSING OUTGOING RESPONSE
    createMessage(messageSet, request, reply);

    // SENDING ANALYTICS
    return messageSet.sendMessageSet()
      .then((response) => {
        lambdaLog.info('Response from chatbase', { response });
        return response;
      })
      .catch((err) => {
        lambdaLog.error(err);
      });
  }
}

function createMessage(messageSet, request, reply, isUser) {
  const unhandledIntents = ['AMAZON.FallbackIntent', 'Unhandled', 'DefaultFallbackIntent'];
  const timestamp = Date.now().toString();

  const newMessage = messageSet.newMessage()
    .setCustomSessionId(request.session.sessionId)
    .setTimestamp(timestamp)
    .setUserId(request.user.userId);

  if (isUser) {
    const slots = {};

    _.each(request.intent.slots, (x) => {
      slots[x.name] = x.value;
    });

    const intentName = request.intent.name || request.request.type;
    const userMessage = request.intent.slots ? JSON.stringify(slots) : '';

    newMessage
      .setAsTypeUser()
      .setMessage(userMessage)
      .setIntent(intentName);

    if (_.includes(unhandledIntents, request.intent.name)) {
      newMessage.setAsNotHandled();
    }
  } else {
    const appMessage = reply.msg.statements.join(' ');

    newMessage
      .setAsTypeAgent()
      .setMessage(appMessage);
  }
}
