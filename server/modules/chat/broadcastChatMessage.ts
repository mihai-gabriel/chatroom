import { WebSocket } from "ws";
import { ObjectId } from "mongodb";

import databaseClient from "../../db/conn";
import * as HttpStatus from "../../utils/httpStatusCodes";
import {
  ChatMessage,
  ChatMessageDto,
  ErrorResponsePayload,
  RequestPayload,
  Room,
  UserDb,
  WsMessage,
  WsMessageType,
} from "../../types";

export const broadcastChatMessage = async (
  client: WebSocket,
  clients: Set<WebSocket>,
  payload: RequestPayload
) => {
  const chatroom = databaseClient.db("chatroom");
  const _users = chatroom.collection<UserDb>("users");
  const _rooms = chatroom.collection<Room>("rooms");
  const messages = chatroom.collection<ChatMessage>("messages");

  const authorId = new ObjectId(payload.userId);
  const roomId = new ObjectId(payload.roomId);
  const text = payload.message?.text;

  if (!text) {
    const errorMessageResponse: WsMessage<ErrorResponsePayload> = {
      type: WsMessageType.SERVER_ERROR,
      payload: {
        code: HttpStatus.BAD_REQUEST,
        message: "Message invalid",
      },
    };

    return errorMessageResponse;
  }

  const insertResult = await messages.insertOne({
    authorId,
    roomId,
    text,
    edited: false,
  });

  const createdMessage = await messages
    .aggregate([
      {
        $match: { _id: insertResult.insertedId },
      },
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          pipeline: [
            { $project: { username: true, fullName: true, email: true } },
          ],
          as: "author",
        },
      },
      { $unwind: "$author" },
      {
        $project: {
          _id: true,
          roomId: true,
          author: true,
          text: true,
          edited: true,
        },
      },
      { $addFields: { creationDate: { $toDate: "$_id" } } },
    ])
    .next();

  if (!createdMessage) {
    const serverErrorResponse: WsMessage<ErrorResponsePayload> = {
      type: WsMessageType.SERVER_ERROR,
      payload: {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Something went wrong with handling this request",
      },
    };

    client.send(JSON.stringify(serverErrorResponse));
    return;
  }

  const response: WsMessage<ChatMessageDto> = {
    type: WsMessageType.CHAT_MESSAGE,
    payload: createdMessage as ChatMessageDto,
  };

  clients.forEach((chatClient) => {
    chatClient.send(JSON.stringify(response));
  });
};
