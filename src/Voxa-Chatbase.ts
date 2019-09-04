/*
 * Copyright (c) 2018 Rain Agency <contact@rain.agency>
 * Author: Rain Agency <contact@rain.agency>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as lambdaLog from "lambda-log";
import * as _ from "lodash";
import { ITransition, IVoxaReply, VoxaApp, VoxaEvent } from "voxa";
/* tslint:disable-next-line */
const Chatbase = require("@google/chatbase");

const pluginConfig = {
  ignoreUsers: [],
};

let defaultConfig: any;

export interface IVoxaChatbaseConfig {
  apiKey: boolean;
  platform?: string;
  suppressSending?: boolean;
}

export function register(skill: VoxaApp, config: IVoxaChatbaseConfig) {
  defaultConfig = _.merge({}, pluginConfig, config);

  skill.onBeforeReplySent(track);

  skill.onSessionEnded(async (
    voxaEvent: VoxaEvent,
    reply: IVoxaReply,
    transition: ITransition,
  ) => {
    await track(voxaEvent, reply, transition, true);
  });
}

async function track(
  voxaEvent: VoxaEvent,
  reply: IVoxaReply,
  transition: ITransition,
  isSessionEndedRequest?: boolean,
) {
  if (_.includes(defaultConfig.ignoreUsers, voxaEvent.user.userId)) { return Promise.resolve(null); }
  if (defaultConfig.suppressSending) { return Promise.resolve(null); }
  if (isSessionEndedRequest && voxaEvent.request.type !== "SessionEndedRequest") { return Promise.resolve(null); }

  lambdaLog.info("Sending to chatbase");

  const messageSet = Chatbase.newMessageSet()
    .setApiKey(defaultConfig.apiKey)
    .setPlatform(defaultConfig.platform || voxaEvent.platform.name)
    .setVersion("1.0");

  // PROCESSING INCOMING RESPONSE
  createUserMessage(messageSet, voxaEvent);

  // PROCESSING OUTGOING RESPONSE
  createBotMessage(messageSet, voxaEvent, reply);

  // SENDING ANALYTICS
  try {
    const response = await messageSet.sendMessageSet();
    lambdaLog.info("Response from chatbase", { response });

    return response;
  } catch (err) {
    lambdaLog.error(err);
  }
}

function createUserMessage(messageSet: any, voxaEvent: VoxaEvent) {
  const unhandledIntents = ["FallbackIntent", "Unhandled", "DefaultFallbackIntent"];
  const intentName = _.get(voxaEvent, "intent.name") || voxaEvent.request.type;

  const userMessage = _.get(voxaEvent, "intent.params") ? JSON.stringify(voxaEvent.intent.params) : "";

  const newMessage = createMessage(messageSet, voxaEvent);

  newMessage
    .setAsTypeUser()
    .setMessage(userMessage)
    .setIntent(intentName);

  if (_.includes(unhandledIntents, _.get(voxaEvent, "intent.name"))) {
    newMessage.setAsNotHandled();
  }
}

function createBotMessage(messageSet: any, voxaEvent: VoxaEvent, reply: IVoxaReply) {
  let appMessage = _.get(reply, "response.outputSpeech.ssml", "");
  appMessage = appMessage || _.get(reply, "response.outputSpeech.text", "");
  appMessage = appMessage.replace("<speak>", "").replace("</speak>", "");

  const newMessage = createMessage(messageSet, voxaEvent);

  newMessage
    .setAsTypeAgent()
    .setMessage(appMessage);
}

function createMessage(messageSet: any, voxaEvent: VoxaEvent) {
  const timestamp = Date.now().toString();

  return messageSet
    .newMessage()
    .setCustomSessionId(voxaEvent.session.sessionId)
    .setTimestamp(timestamp)
    .setUserId(voxaEvent.user.userId);
}
