import type { Database } from "./database"
import type { Chat, Message, ChatMetadata, MessageMetadata } from "./chat"

type DbChat = Database["public"]["Tables"]["chats"]["Row"]
type DbMessage = Database["public"]["Tables"]["messages"]["Row"]

export function dbChatToChat(dbChat: DbChat): Chat {
  return {
    id: dbChat.id,
    title: dbChat.title,
    created_at: new Date(dbChat.created_at),
    user_id: dbChat.user_id,
    metadata: dbChat.metadata as ChatMetadata,
    context_summary: dbChat.context_summary,
    status: dbChat.status,
    bookmarked: dbChat.bookmarked,
    shared_users: dbChat.shared_users,
  }
}

export function chatToDbChat(chat: Partial<Chat>): Database["public"]["Tables"]["chats"]["Insert"] {
  const data: Database["public"]["Tables"]["chats"]["Insert"] = {
    user_id: chat.user_id!,
  }

  if (chat.title) data.title = chat.title
  if (chat.metadata) data.metadata = chat.metadata
  if (chat.context_summary) data.context_summary = chat.context_summary
  if (chat.status) data.status = chat.status
  if (chat.bookmarked !== undefined) data.bookmarked = chat.bookmarked
  if (chat.shared_users) data.shared_users = chat.shared_users

  return data
}

export function dbMessageToMessage(dbMessage: DbMessage): Message {
  return {
    id: dbMessage.id,
    chat_id: dbMessage.chat_id,
    user_id: dbMessage.user_id || undefined,
    role: dbMessage.role,
    content: dbMessage.content,
    created_at: new Date(dbMessage.created_at),
    updated_at: new Date(dbMessage.updated_at),
    deleted: dbMessage.deleted,
    metadata: dbMessage.metadata as MessageMetadata,
    status: {
      sent: dbMessage.sent,
      delivered: dbMessage.delivered,
      read: dbMessage.read,
      error: dbMessage.error_message || undefined,
      retries: dbMessage.retries,
      status: dbMessage.status,
    },
  }
}

export function messageToDbMessage(message: Partial<Message>): Database["public"]["Tables"]["messages"]["Insert"] {
  const data: Database["public"]["Tables"]["messages"]["Insert"] = {
    chat_id: message.chat_id!,
    role: message.role!,
    content: message.content!,
  }

  if (message.user_id) data.user_id = message.user_id
  if (message.deleted !== undefined) data.deleted = message.deleted
  if (message.metadata) data.metadata = message.metadata
  if (message.status?.sent !== undefined) data.sent = message.status.sent
  if (message.status?.delivered !== undefined) data.delivered = message.status.delivered
  if (message.status?.read !== undefined) data.read = message.status.read
  if (message.status?.error) data.error_message = message.status.error
  if (message.status?.retries !== undefined) data.retries = message.status.retries
  if (message.status?.status) data.status = message.status.status

  return data
}
