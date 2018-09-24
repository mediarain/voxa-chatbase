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

    const timestamp = Date.now().toString();
    const intentName = request.intent.name || request.request.type;
    const slots = {};

    _.each(request.intent.slots, (x) => {
      slots[x.name] = x.value;
    });

    const userMessage = request.intent.slots ? JSON.stringify(slots) : '';
    const appMessage = reply.msg.statements.join(' ');

    const messageSet = Chatbase.newMessageSet()
      .setApiKey(pluginConfig.apiKey)
      .setPlatform(pluginConfig.platform)
      .setVersion('1.0');

    // PROCESSING INCOMING RESPONSE
    const user = messageSet.newMessage()
      .setAsTypeUser()
      .setCustomSessionId(request.session.sessionId)
      .setIntent(intentName)
      .setMessage(userMessage)
      .setTimestamp(timestamp)
      .setUserId(request.user.userId);

    if (_.includes(['AMAZON.FallbackIntent', 'Unhandled', 'DefaultFallbackIntent'], request.intent.name)) {
      user.setAsNotHandled();
    }

    // PROCESSING OUTGOING RESPONSE
    messageSet.newMessage()
      .setAsTypeAgent()
      .setCustomSessionId(request.session.sessionId)
      .setMessage(appMessage)
      .setTimestamp(timestamp)
      .setUserId(request.user.userId);

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
