import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  chatId: string
}

export interface StreamingResponse {
  type: "chunk" | "complete" | "error" | "message" | "done"
  data?: any
  content?: string
  message?: any
  error?: string
}

export class AIService {
  private static baseURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000"

  static async getAuthToken(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  static async sendMessage(chatId: string, content: string): Promise<any> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/messages/chat/${chatId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "user",
        content,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to send message")
    }

    return response.json()
  }

  static async createChat(title: string = "New Chat", systemPrompt?: string): Promise<string> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/chats/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        system_prompt: systemPrompt,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to create chat")
    }

    const chat = await response.json()
    return chat.id
  }

  static async sendMessageStream(chatId: string, content: string): Promise<ReadableStream> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/messages/chat/${chatId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "user",
        content,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to send message")
    }

    return response.body!
  }

  static async *parseStreamingResponse(stream: ReadableStream): AsyncGenerator<StreamingResponse> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              yield data as StreamingResponse
            } catch (e) {
              logger.warn("Failed to parse streaming data", { component: "ai-service", line })
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  static async getChatMessages(chatId: string, limit = 50, offset = 0): Promise<any[]> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/messages/chat/${chatId}?limit=${limit}&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to fetch messages")
    }

    return response.json()
  }

  static async updateMessage(messageId: string, content: string): Promise<any> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/messages/${messageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to update message")
    }

    return response.json()
  }

  static async deleteMessage(messageId: string): Promise<void> {
    const token = await this.getAuthToken()

    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.baseURL}/api/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to delete message")
    }
  }
}
