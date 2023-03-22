import { User } from "./UserDB";

export interface ChatMessage {
  _id: string;
  author: User;
  roomId: string;
  text: string;
  creationDate: string;
}

// TODO: Needs refactoring
export interface FullChatMessage {
  id: number;
  authorName: string;
  text: string;
}
