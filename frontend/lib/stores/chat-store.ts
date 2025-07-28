import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createClient } from "@/lib/supabase/client"
import { AIService } from "@/lib/services/ai-service"
import { logger } from "@/lib/utils/logger"
import { dbChatToChat, chatToDbChat, dbMessageToMessage, messageToDbMessage } from "@/lib/types/converters"
import type { Chat, Message, Attachment, Reaction } from "@/lib/types"

const generateChatTitle = (content: string): string => {
  let cleaned = content.trim().replace(/\s+/g, " ")
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")

  const words = cleaned.split(/\s+/).filter((word) => word.length > 0)
  const titleWords = words.slice(0, Math.min(6, words.length))
  let title = titleWords.join(" ")

  if (title.length > 50) {
    title = title.substring(0, 47) + "..."
  }

  return title || "New Chat"
}

interface ChatState {
  chats: Chat[]
  messages: Message[]
  currentChatId: string | null
  loading: boolean
  isStreaming: boolean
  searchQuery: string
  attachments: Attachment[]

  loadChats: () => Promise<void>
  loadMessages: (chatId: string) => Promise<void>
  createChat: (title?: string, template?: Partial<Chat>) => Promise<string>
  selectChat: (chatId: string) => void
  clearCurrentChat: () => void
  clearAll: () => void
  deleteChat: (chatId: string) => Promise<void>
  updateChat: (chatId: string, updates: Partial<Chat>) => Promise<void>
  duplicateChat: (chatId: string) => Promise<string>
  archiveChat: (chatId: string) => Promise<void>

  sendMessage: (content: string, chatId?: string) => Promise<string>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  reactToMessage: (messageId: string, reaction: "liked" | "disliked" | "flagged") => Promise<void>

  searchMessages: (query: string) => Promise<Message[]>
  setSearchQuery: (query: string) => void

  addAttachment: (attachment: Attachment) => void
  removeAttachment: (attachmentId: string) => void
  clearAttachments: () => void

  exportChat: (chatId: string, format: "json" | "markdown" | "txt") => Promise<string>
  importChat: (data: string, format: "json") => Promise<void>

  getCurrentChat: () => Chat | null
  getCurrentMessages: () => Message[]
  getFilteredChats: (filter: "all" | "bookmarked" | "archived") => Chat[]
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      messages: [],
      currentChatId: null,
      loading: false,
      isStreaming: false,
      searchQuery: "",
      attachments: [],

      loadChats: async () => {
        try {
          set({ loading: true })
          const supabase = createClient()

          const { data: chats, error } = await supabase
            .from("chats")
            .select("*")
            .order("created_at", { ascending: false })

          if (error) throw error

          set({ chats: chats || [], loading: false })
        } catch (error) {
          logger.error("Error loading chats", error as Error, { component: "chat-store" })
          set({ loading: false })
        }
      },

      loadMessages: async (chatId: string) => {
        try {
          const supabase = createClient()

          const { data: messages, error } = await supabase
            .from("messages")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })

          if (error) throw error

          set({ messages: messages || [] })
        } catch (error) {
          logger.error("Error loading messages", error as Error, { component: "chat-store" })
        }
      },

      createChat: async (title = "New Chat", template: Partial<Chat> = {}) => {
        try {
          const supabase = createClient()
          const user = await supabase.auth.getUser()

          const chatData = {
            title,
            user_id: user.data.user?.id!,
            status: "active" as const,
            metadata: {
              totalMessages: 0,
              totalTokens: 0,
              averageResponseTime: 0,
              lastActivity: new Date().toISOString(),
            },
            context_summary: "",
            bookmarked: false,
            shared_users: [],
            ...template,
          }

          const { data, error } = await supabase.from("chats").insert(chatData).select().single()
          if (error) throw error

          const chat: Chat = {
            id: data.id,
            title: data.title,
            created_at: new Date(data.created_at),
            user_id: data.user_id,
            metadata: data.metadata,
            context_summary: data.context_summary,
            status: data.status,
            bookmarked: data.bookmarked,
            shared_users: data.shared_users,
          }

          set((state) => ({
            chats: [chat, ...state.chats],
            currentChatId: chat.id,
          }))

          return chat.id
        } catch (error) {
          logger.error("Error creating chat", error as Error, { component: "chat-store" })
          throw error
        }
      },

      selectChat: (chatId: string) => {
        set({ currentChatId: chatId })
        get().loadMessages(chatId)
      },

      clearCurrentChat: () => {
        set({ currentChatId: null, messages: [] })
      },

      clearAll: () => {
        set({
          chats: [],
          messages: [],
          currentChatId: null,
          loading: false,
          isStreaming: false,
          searchQuery: "",
          attachments: [],
        })
      },

      deleteChat: async (chatId: string) => {
        try {
          const supabase = createClient()
          await supabase.from("messages").delete().eq("chat_id", chatId)
          const { error } = await supabase.from("chats").delete().eq("id", chatId)
          if (error) throw error

          set((state) => ({
            chats: state.chats.filter((chat) => chat.id !== chatId),
            currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
            messages: state.currentChatId === chatId ? [] : state.messages,
          }))
        } catch (error) {
          logger.error("Error deleting chat", error as Error, { component: "chat-store", chatId })
          throw error
        }
      },

      updateChat: async (chatId: string, updates: Partial<Chat>) => {
        try {
          const supabase = createClient()
          const { error } = await supabase.from("chats").update(updates).eq("id", chatId)

          if (error) throw error

          set((state) => ({
            chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, ...updates } : chat)),
          }))
        } catch (error) {
          logger.error("Error updating chat", error as Error, { component: "chat-store", chatId })
          throw error
        }
      },

      duplicateChat: async (chatId: string) => {
        try {
          const chat = get().chats.find((c) => c.id === chatId)
          if (!chat) throw new Error("Chat not found")

          const newChatId = await get().createChat(`${chat.title} (Copy)`)

          const supabase = createClient()
          const { data: messages } = await supabase.from("messages").select("*").eq("chat_id", chatId)

          if (messages && messages.length > 0) {
            const messagesToCopy = messages.map((msg) => ({
              chat_id: newChatId,
              user_id: msg.user_id,
              role: msg.role,
              content: msg.content,
              deleted: msg.deleted,
              metadata: msg.metadata,
              sent: msg.sent,
              delivered: msg.delivered,
              read: msg.read,
              error_message: msg.error_message,
              retries: msg.retries,
              status: msg.status,
            }))
            await supabase.from("messages").insert(messagesToCopy)
          }

          return newChatId
        } catch (error) {
          logger.error("Error duplicating chat", error as Error, { component: "chat-store", chatId })
          throw error
        }
      },

      archiveChat: async (chatId: string) => {
        await get().updateChat(chatId, { status: "archived" })
      },

      sendMessage: async (content: string, chatId?: string) => {
        try {
          let targetChatId = chatId || get().currentChatId

          if (!targetChatId) {
            targetChatId = await get().createChat(generateChatTitle(content))
          }

          set({ isStreaming: true })

          const userMessageData = {
            chat_id: targetChatId,
            role: "user" as const,
            content,
            deleted: false,
            metadata: {},
            sent: true,
            delivered: true,
            read: false,
            retries: 0,
            status: "sent" as const,
          }

          const supabase = createClient()
          const { data: insertedMessage, error: messageError } = await supabase
            .from("messages")
            .insert(userMessageData)
            .select()
            .single()

          if (messageError) throw messageError

          const userMessage: Message = {
            id: insertedMessage.id,
            chat_id: insertedMessage.chat_id,
            user_id: insertedMessage.user_id,
            role: insertedMessage.role,
            content: insertedMessage.content,
            created_at: new Date(insertedMessage.created_at),
            updated_at: new Date(insertedMessage.updated_at),
            deleted: insertedMessage.deleted,
            metadata: insertedMessage.metadata,
            status: {
              sent: insertedMessage.sent,
              delivered: insertedMessage.delivered,
              read: insertedMessage.read,
              error: insertedMessage.error_message || undefined,
              retries: insertedMessage.retries,
              status: insertedMessage.status,
            },
          }

          set((state) => ({
            messages: [...state.messages, userMessage],
            attachments: [],
          }))

          const aiMessage = await AIService.sendMessage(targetChatId, content)

          const assistantMessage: Message = {
            id: aiMessage.id,
            chat_id: targetChatId,
            role: "assistant",
            content: aiMessage.content,
            created_at: new Date(aiMessage.created_at),
            updated_at: new Date(),
            deleted: false,
            metadata: {},
            status: {
              sent: true,
              delivered: true,
              read: false,
              retries: 0,
              status: "sent",
            },
          }

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            isStreaming: false,
          }))

          return targetChatId
        } catch (error) {
          logger.error("Error sending message", error as Error, { component: "chat-store" })
          set({ isStreaming: false })
          throw error
        }
      },

      editMessage: async (messageId: string, content: string) => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from("messages")
            .update({ content, updated_at: new Date() })
            .eq("id", messageId)

          if (error) throw error

          set((state) => ({
            messages: state.messages.map((msg) =>
              msg.id === messageId ? { ...msg, content, updated_at: new Date() } : msg
            ),
          }))
        } catch (error) {
          logger.error("Error editing message", error as Error, { component: "chat-store", messageId })
          throw error
        }
      },

      deleteMessage: async (messageId: string) => {
        try {
          const supabase = createClient()
          const { error } = await supabase.from("messages").update({ deleted: true }).eq("id", messageId)

          if (error) throw error

          set((state) => ({
            messages: state.messages.map((msg) => (msg.id === messageId ? { ...msg, deleted: true } : msg)),
          }))
        } catch (error) {
          logger.error("Error deleting message", error as Error, { component: "chat-store", messageId })
          throw error
        }
      },

      reactToMessage: async (messageId: string, reaction: "liked" | "disliked" | "flagged") => {
        try {
          const supabase = createClient()
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser()

          const userId = user?.id
          if (authError || !userId) throw new Error("User not authenticated")

          // 1. Check if reaction exists
          const { data: existingReactions, error: selectError } = await supabase
            .from("reactions")
            .select("*")
            .eq("user_id", userId)
            .eq("message_id", messageId)
            .limit(1)

          if (selectError) throw selectError

          const existing = existingReactions[0]

          const emojiMap = {
            liked: "👍",
            disliked: "👎",
            flagged: "🚩",
          }

          if (existing) {
            if (existing.type === reaction) {
              // 2. If same reaction → remove
              const { error: deleteError } = await supabase
                .from("reactions")
                .delete()
                .eq("id", existing.id)

              if (deleteError) throw deleteError

              // Remove from local store
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                      ...msg,
                      reactions: (msg.reactions || []).filter((r) => r.user_id !== userId),
                    }
                    : msg
                ),
              }))
            } else {
              // 3. Update with new type
              const { error: updateError } = await supabase
                .from("reactions")
                .update({
                  type: reaction,
                  emoji: emojiMap[reaction],
                  created_at: new Date().toISOString(),
                })
                .eq("id", existing.id)

              if (updateError) throw updateError

              // Update local store
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                      ...msg,
                      reactions: (msg.reactions || []).map((r) =>
                        r.user_id === userId
                          ? {
                            ...r,
                            type: reaction,
                            emoji: emojiMap[reaction],
                            created_at: new Date().toISOString(),
                          }
                          : r
                      ),
                    }
                    : msg
                ),
              }))
            }
          } else {
            // 4. Insert new reaction
            const { data, error: insertError } = await supabase
              .from("reactions")
              .insert({
                user_id: userId,
                message_id: messageId,
                type: reaction,
                emoji: emojiMap[reaction],
                created_at: new Date().toISOString(),
              })
              .select()
              .single()

            if (insertError) throw insertError

            // Add to local store
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.id === messageId
                  ? {
                    ...msg,
                    reactions: [
                      ...(msg.reactions || []).filter((r) => r.user_id !== userId),
                      {
                        id: data.id,
                        user_id: userId,
                        type: reaction,
                        emoji: emojiMap[reaction],
                        created_at: data.created_at,
                      },
                    ],
                  }
                  : msg
              ),
            }))
          }
        } catch (error) {
          logger.error("Error reacting to message", error as Error, {
            component: "chat-store",
            messageId,
          })
          throw error
        }
      },

      searchMessages: async (query: string) => {
        try {
          const supabase = createClient()
          const { data: messages, error } = await supabase.from("messages").select("*").textSearch("content", query)

          if (error) throw error
          return messages || []
        } catch (error) {
          logger.error("Error searching messages", error as Error, { component: "chat-store" })
          return []
        }
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      addAttachment: (attachment: Attachment) => {
        set((state) => ({ attachments: [...state.attachments, attachment] }))
      },

      removeAttachment: (attachmentId: string) => {
        set((state) => ({ attachments: state.attachments.filter((a) => a.id !== attachmentId) }))
      },

      clearAttachments: () => {
        set({ attachments: [] })
      },

      exportChat: async (chatId: string, format: "json" | "markdown" | "txt") => {
        try {
          const chat = get().chats.find((c) => c.id === chatId)
          if (!chat) throw new Error("Chat not found")

          const supabase = createClient()
          const { data: messages } = await supabase
            .from("messages")
            .select("*")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })

          switch (format) {
            case "json":
              return JSON.stringify({ chat, messages }, null, 2)
            case "markdown":
              let markdown = `# ${chat.title}\n\n`
              messages?.forEach((msg) => {
                markdown += `**${msg.role}**: ${msg.content}\n\n`
              })
              return markdown
            case "txt":
              let text = `${chat.title}\n\n`
              messages?.forEach((msg) => {
                text += `${msg.role}: ${msg.content}\n\n`
              })
              return text
            default:
              throw new Error("Unsupported format")
          }
        } catch (error) {
          logger.error("Error exporting chat", error as Error, { component: "chat-store", chatId, format })
          throw error
        }
      },

      importChat: async (data: string, format: "json") => {
        try {
          if (format !== "json") throw new Error("Only JSON format is supported")

          const { chat, messages } = JSON.parse(data)
          const newChatId = await get().createChat(chat.title)

          if (messages && messages.length > 0) {
            const supabase = createClient()
            const messagesToImport = messages.map((msg: any) => ({
              chat_id: newChatId,
              user_id: msg.user_id,
              role: msg.role,
              content: msg.content,
              deleted: msg.deleted,
              metadata: msg.metadata,
              sent: msg.sent,
              delivered: msg.delivered,
              read: msg.read,
              error_message: msg.error_message,
              retries: msg.retries,
              status: msg.status,
            }))

            await supabase.from("messages").insert(messagesToImport)
            await get().loadChats()
          }
        } catch (error) {
          logger.error("Error importing chat", error as Error, { component: "chat-store" })
          throw error
        }
      },

      getCurrentChat: () => {
        const { chats, currentChatId } = get()
        return chats.find((chat) => chat.id === currentChatId) || null
      },

      getCurrentMessages: () => {
        return get().messages.filter((msg) => !msg.deleted)
      },

      getFilteredChats: (filter: "all" | "bookmarked" | "archived") => {
        const { chats } = get()

        switch (filter) {
          case "bookmarked":
            return chats.filter((chat) => chat.bookmarked)
          case "archived":
            return chats.filter((chat) => chat.status === "archived")
          default:
            return chats.filter((chat) => chat.status === "active")
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        currentChatId: state.currentChatId,
      }),
    }
  )
)
