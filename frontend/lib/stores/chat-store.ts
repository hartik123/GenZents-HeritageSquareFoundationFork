import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createClient } from "@/lib/supabase/client"
import { nanoid } from "nanoid"

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  uploadedAt: string
}

export interface Message {
  id: string
  chat_id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  updated_at?: string
  metadata?: {
    model?: string
    tokens?: number
    cost?: number
    processingTime?: number
  }
  attachments?: Attachment[]
  reactions?: Array<{ type: "thumbs_up" | "thumbs_down"; userId: string }>
  edited?: boolean
  parentId?: string // for threading
  status?: "sending" | "sent" | "delivered" | "error"
}

export interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
  user_id: string
  model?: string
  system_prompt?: string
  tags?: string[]
  bookmarked: boolean
  archived: boolean
  shared: boolean
  collaborators?: string[]
  version: number
  parentVersion?: string
  messages: Message[]
}

export interface ContextFile {
  id: string
  path: string
  type: "file" | "folder" | "symbol" | "url" | "database"
  content?: string
  metadata?: any
}

interface ChatState {
  chats: Chat[]
  currentChatId: string | null
  loading: boolean
  isStreaming: boolean
  searchQuery: string
  contextFiles: ContextFile[]
  attachments: Attachment[]

  // Actions
  loadChats: () => Promise<void>
  createChat: (title?: string, template?: Partial<Chat>) => Promise<string>
  selectChat: (chatId: string) => void
  deleteChat: (chatId: string) => Promise<void>
  updateChat: (chatId: string, updates: Partial<Chat>) => Promise<void>
  duplicateChat: (chatId: string) => Promise<string>
  archiveChat: (chatId: string) => Promise<void>

  // Messages
  sendMessage: (content: string, chatId?: string, parentId?: string) => Promise<string>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  reactToMessage: (messageId: string, reaction: "thumbs_up" | "thumbs_down") => Promise<void>
  regenerateMessage: (messageId: string) => Promise<void>

  // Search
  searchMessages: (query: string) => Promise<Message[]>
  setSearchQuery: (query: string) => void

  // Context
  addContextFile: (file: ContextFile) => void
  removeContextFile: (fileId: string) => void
  clearContext: () => void

  // Attachments
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (attachmentId: string) => void
  clearAttachments: () => void

  // Export/Import
  exportChat: (chatId: string, format: "json" | "markdown" | "txt") => Promise<string>
  importChat: (data: string, format: "json") => Promise<void>

  // Getters
  getCurrentChat: () => Chat | null
  getFilteredChats: (filter: "all" | "bookmarked" | "archived" | "shared") => Chat[]
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      currentChatId: null,
      loading: false,
      isStreaming: false,
      searchQuery: "",
      contextFiles: [],
      attachments: [],

      loadChats: async () => {
        try {
          set({ loading: true })
          const supabase = createClient()

          const { data: chats, error } = await supabase
            .from("chats")
            .select(
              `
              *,
              messages (*)
            `
            )
            .order("updated_at", { ascending: false })

          if (error) throw error

          set({
            chats:
              chats?.map((chat) => ({
                ...chat,
                messages: chat.messages || [],
              })) || [],
            loading: false,
          })
        } catch (error) {
          console.error("Error loading chats:", error)
          set({ loading: false })
        }
      },

      createChat: async (title = "New Chat", template = {}) => {
        try {
          const supabase = createClient()
          const chatId = nanoid()

          const newChat: Partial<Chat> = {
            id: chatId,
            title,
            user_id: (await supabase.auth.getUser()).data.user?.id!,
            bookmarked: false,
            archived: false,
            shared: false,
            version: 1,
            ...template,
          }

          const { error } = await supabase.from("chats").insert(newChat)
          if (error) throw error

          const chat: Chat = {
            ...(newChat as Chat),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: [],
          }

          set((state) => ({
            chats: [chat, ...state.chats],
            currentChatId: chatId,
          }))

          return chatId
        } catch (error) {
          console.error("Error creating chat:", error)
          throw error
        }
      },

      selectChat: (chatId: string) => {
        set({ currentChatId: chatId })
      },

      deleteChat: async (chatId: string) => {
        try {
          const supabase = createClient()

          // Delete messages first
          await supabase.from("messages").delete().eq("chat_id", chatId)

          // Delete chat
          const { error } = await supabase.from("chats").delete().eq("id", chatId)
          if (error) throw error

          set((state) => ({
            chats: state.chats.filter((chat) => chat.id !== chatId),
            currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
          }))
        } catch (error) {
          console.error("Error deleting chat:", error)
          throw error
        }
      },

      updateChat: async (chatId: string, updates: Partial<Chat>) => {
        try {
          const supabase = createClient()

          const { error } = await supabase
            .from("chats")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", chatId)

          if (error) throw error

          set((state) => ({
            chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, ...updates } : chat)),
          }))
        } catch (error) {
          console.error("Error updating chat:", error)
          throw error
        }
      },

      duplicateChat: async (chatId: string) => {
        try {
          const chat = get().chats.find((c) => c.id === chatId)
          if (!chat) throw new Error("Chat not found")

          const newChatId = await get().createChat(`${chat.title} (Copy)`, {
            model: chat.model,
            system_prompt: chat.system_prompt,
            tags: chat.tags,
          })

          // Copy messages
          const supabase = createClient()
          const messagesToCopy = chat.messages.map((msg) => ({
            ...msg,
            id: nanoid(),
            chat_id: newChatId,
          }))

          if (messagesToCopy.length > 0) {
            await supabase.from("messages").insert(messagesToCopy)
          }

          return newChatId
        } catch (error) {
          console.error("Error duplicating chat:", error)
          throw error
        }
      },

      archiveChat: async (chatId: string) => {
        await get().updateChat(chatId, { archived: true })
      },

      sendMessage: async (content: string, chatId?: string, parentId?: string) => {
        try {
          const supabase = createClient()
          let targetChatId = chatId || get().currentChatId

          if (!targetChatId) {
            targetChatId = await get().createChat()
          }

          set({ isStreaming: true })

          // Create user message
          const userMessage: Message = {
            id: nanoid(),
            chat_id: targetChatId,
            role: "user",
            content,
            created_at: new Date().toISOString(),
            status: "sending",
            parentId,
            attachments: get().attachments,
          }

          // Save to database
          await supabase.from("messages").insert({
            id: userMessage.id,
            chat_id: userMessage.chat_id,
            role: userMessage.role,
            content: userMessage.content,
            metadata: userMessage.metadata,
          })

          // Update local state
          set((state) => ({
            chats: state.chats.map((chat) =>
              chat.id === targetChatId
                ? { ...chat, messages: [...chat.messages, { ...userMessage, status: "sent" }] }
                : chat
            ),
            attachments: [], // Clear attachments after sending
          }))

          // Simulate AI response (replace with actual AI integration)
          setTimeout(async () => {
            const aiMessage: Message = {
              id: nanoid(),
              chat_id: targetChatId,
              role: "assistant",
              content: `This is a simulated AI response to: "${content}". In a real implementation, this would be replaced with actual AI integration.`,
              created_at: new Date().toISOString(),
              metadata: {
                model: "gpt-4",
                tokens: 150,
                processingTime: 1500,
              },
            }

            await supabase.from("messages").insert({
              id: aiMessage.id,
              chat_id: aiMessage.chat_id,
              role: aiMessage.role,
              content: aiMessage.content,
              metadata: aiMessage.metadata,
            })

            set((state) => ({
              chats: state.chats.map((chat) =>
                chat.id === targetChatId ? { ...chat, messages: [...chat.messages, aiMessage] } : chat
              ),
              isStreaming: false,
            }))
          }, 1500)

          return targetChatId
        } catch (error) {
          console.error("Error sending message:", error)
          set({ isStreaming: false })
          throw error
        }
      },

      editMessage: async (messageId: string, content: string) => {
        try {
          const supabase = createClient()

          const { error } = await supabase
            .from("messages")
            .update({
              content,
              updated_at: new Date().toISOString(),
              metadata: { edited: true },
            })
            .eq("id", messageId)

          if (error) throw error

          set((state) => ({
            chats: state.chats.map((chat) => ({
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content, edited: true, updated_at: new Date().toISOString() } : msg
              ),
            })),
          }))
        } catch (error) {
          console.error("Error editing message:", error)
          throw error
        }
      },

      deleteMessage: async (messageId: string) => {
        try {
          const supabase = createClient()

          const { error } = await supabase.from("messages").delete().eq("id", messageId)
          if (error) throw error

          set((state) => ({
            chats: state.chats.map((chat) => ({
              ...chat,
              messages: chat.messages.filter((msg) => msg.id !== messageId),
            })),
          }))
        } catch (error) {
          console.error("Error deleting message:", error)
          throw error
        }
      },

      reactToMessage: async (messageId: string, reaction: "thumbs_up" | "thumbs_down") => {
        try {
          const supabase = createClient()
          const userId = (await supabase.auth.getUser()).data.user?.id

          if (!userId) throw new Error("User not authenticated")

          set((state) => ({
            chats: state.chats.map((chat) => ({
              ...chat,
              messages: chat.messages.map((msg) => {
                if (msg.id === messageId) {
                  const reactions = msg.reactions || []
                  const existingReaction = reactions.find((r) => r.userId === userId)

                  if (existingReaction) {
                    return {
                      ...msg,
                      reactions: reactions.filter((r) => r.userId !== userId),
                    }
                  } else {
                    return {
                      ...msg,
                      reactions: [...reactions, { type: reaction, userId }],
                    }
                  }
                }
                return msg
              }),
            })),
          }))
        } catch (error) {
          console.error("Error reacting to message:", error)
          throw error
        }
      },

      regenerateMessage: async (messageId: string) => {
        try {
          const chat = get().getCurrentChat()
          if (!chat) return

          const messageIndex = chat.messages.findIndex((m) => m.id === messageId)
          if (messageIndex === -1) return

          const previousMessage = chat.messages[messageIndex - 1]
          if (!previousMessage || previousMessage.role !== "user") return

          // Delete the current AI message
          await get().deleteMessage(messageId)

          // Regenerate response
          await get().sendMessage(previousMessage.content, chat.id)
        } catch (error) {
          console.error("Error regenerating message:", error)
          throw error
        }
      },

      searchMessages: async (query: string) => {
        try {
          const supabase = createClient()

          const { data: messages, error } = await supabase
            .from("messages")
            .select("*")
            .textSearch("content", query)
            .limit(50)

          if (error) throw error
          return messages || []
        } catch (error) {
          console.error("Error searching messages:", error)
          return []
        }
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      addContextFile: (file: ContextFile) => {
        set((state) => ({
          contextFiles: [...state.contextFiles, file],
        }))
      },

      removeContextFile: (fileId: string) => {
        set((state) => ({
          contextFiles: state.contextFiles.filter((f) => f.id !== fileId),
        }))
      },

      clearContext: () => {
        set({ contextFiles: [] })
      },

      addAttachment: (attachment: Attachment) => {
        set((state) => ({
          attachments: [...state.attachments, attachment],
        }))
      },

      removeAttachment: (attachmentId: string) => {
        set((state) => ({
          attachments: state.attachments.filter((a) => a.id !== attachmentId),
        }))
      },

      clearAttachments: () => {
        set({ attachments: [] })
      },

      exportChat: async (chatId: string, format: "json" | "markdown" | "txt") => {
        try {
          const chat = get().chats.find((c) => c.id === chatId)
          if (!chat) throw new Error("Chat not found")

          switch (format) {
            case "json":
              return JSON.stringify(chat, null, 2)

            case "markdown":
              let markdown = `# ${chat.title}\n\n`
              markdown += `Created: ${new Date(chat.created_at).toLocaleString()}\n\n`

              chat.messages.forEach((msg) => {
                markdown += `## ${msg.role === "user" ? "User" : "Assistant"}\n\n`
                markdown += `${msg.content}\n\n`
                if (msg.created_at) {
                  markdown += `*${new Date(msg.created_at).toLocaleString()}*\n\n`
                }
              })

              return markdown

            case "txt":
              let text = `${chat.title}\n${"=".repeat(chat.title.length)}\n\n`

              chat.messages.forEach((msg) => {
                text += `[${msg.role.toUpperCase()}]: ${msg.content}\n\n`
              })

              return text

            default:
              throw new Error("Unsupported format")
          }
        } catch (error) {
          console.error("Error exporting chat:", error)
          throw error
        }
      },

      importChat: async (data: string, format: "json") => {
        try {
          if (format === "json") {
            const chatData = JSON.parse(data)
            const newChatId = await get().createChat(chatData.title, {
              model: chatData.model,
              system_prompt: chatData.system_prompt,
              tags: chatData.tags,
            })

            if (chatData.messages && chatData.messages.length > 0) {
              const supabase = createClient()
              const messagesToImport = chatData.messages.map((msg: Message) => ({
                ...msg,
                id: nanoid(),
                chat_id: newChatId,
              }))

              await supabase.from("messages").insert(messagesToImport)
            }
          }
        } catch (error) {
          console.error("Error importing chat:", error)
          throw error
        }
      },

      getCurrentChat: () => {
        const { chats, currentChatId } = get()
        return chats.find((chat) => chat.id === currentChatId) || null
      },

      getFilteredChats: (filter: "all" | "bookmarked" | "archived" | "shared") => {
        const { chats } = get()

        switch (filter) {
          case "bookmarked":
            return chats.filter((chat) => chat.bookmarked)
          case "archived":
            return chats.filter((chat) => chat.archived)
          case "shared":
            return chats.filter((chat) => chat.shared)
          default:
            return chats.filter((chat) => !chat.archived)
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        currentChatId: state.currentChatId,
        contextFiles: state.contextFiles,
      }),
    }
  )
)
