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

import _ from "lodash";
import { ITransition, IVoxaReply, VoxaApp, VoxaEvent } from "voxa";
import Chatbase from "@google/chatbase";

const pluginConfig = {
  ignoreUsers: []
};

let defaultConfig: any;

export interface IVoxaChatbaseConfig {
  apiKey: string;
  platform?: string;
  suppressSending?: boolean;
  ignoreUsers?: (string | RegExp)[];
}

export function register(skill: VoxaApp, config: IVoxaChatbaseConfig) {
  defaultConfig = _.merge({}, pluginConfig, config);

  skill.onBeforeReplySent(track);

  skill.onSessionEnded(
    async (
      voxaEvent: VoxaEvent,
      reply: IVoxaReply,
      transition: ITransition
    ) => {
      await track(voxaEvent, reply, transition, true);
    }
  );
}

async function track(
  voxaEvent: VoxaEvent,
  reply: IVoxaReply,
  _transition: ITransition,
  isSessionEndedRequest?: boolean
) {
  for (const ignoreRule of defaultConfig.ignoreUsers) {
    if (voxaEvent.user.userId.match(ignoreRule)) {
      return null;
    }
  }
  if (defaultConfig.suppressSending) {
    return Promise.resolve(null);
  }
  if (
    isSessionEndedRequest &&
    voxaEvent.request.type !== "SessionEndedRequest"
  ) {
    return Promise.resolve(null);
  }

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
    voxaEvent.log.debug("Response from chatbase", { response });

    return response;
  } catch (err) {
    voxaEvent.log.error(err);
  }
}

function createUserMessage(messageSet: any, voxaEvent: VoxaEvent) {
  const unhandledIntents = [
    "FallbackIntent",
    "Unhandled",
    "DefaultFallbackIntent"
  ];
  const intentName = _.get(voxaEvent, "intent.name") || voxaEvent.request.type;
  const params = _.get(voxaEvent, "intent.params");

  const userMessage = params ? JSON.stringify(params) : "";

  const newMessage = createMessage(messageSet, voxaEvent);

  newMessage
    .setAsTypeUser()
    .setMessage(userMessage)
    .setIntent(intentName);

  if (_.includes(unhandledIntents, _.get(voxaEvent, "intent.name"))) {
    newMessage.setAsNotHandled();
  }
}

function createBotMessage(
  messageSet: any,
  voxaEvent: VoxaEvent,
  reply: IVoxaReply
) {
  let appMessage = _.get(reply, "response.outputSpeech.ssml", "");
  appMessage = appMessage || _.get(reply, "response.outputSpeech.text", "");
  appMessage = appMessage.replace("<speak>", "").replace("</speak>", "");

  const newMessage = createMessage(messageSet, voxaEvent);

  newMessage.setAsTypeAgent().setMessage(appMessage);
}

function createMessage(messageSet: any, voxaEvent: VoxaEvent) {
  const timestamp = Date.now().toString();

  return messageSet
    .newMessage()
    .setCustomSessionId(voxaEvent.session.sessionId)
    .setTimestamp(timestamp)
    .setUserId(voxaEvent.user.userId);
}

export default register;
