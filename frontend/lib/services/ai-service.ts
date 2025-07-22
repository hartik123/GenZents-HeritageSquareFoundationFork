import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import { APIClient } from "./api-client"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  chatId: string
}

export interface StreamingResponse {
  type: "chunk" | "complete" | "error" | "message" | "done" | "command"
  data?: any
  content?: string
  message?: any
  error?: string
}

export class AIService {
  static async getAuthToken(): Promise<string | null> {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  static async sendMessage(chatId: string, content: string): Promise<any> {
    // Use APIClient for AI processing (proxies to backend)
    return APIClient.sendMessage(chatId, content)
  }

  static async createChat(title: string = "New Chat"): Promise<string> {
    // Use APIClient for simple chat creation (Direct Supabase)
    const chat = await APIClient.createChat({
      title,
    })
    return chat.id
  }

  static async sendMessageStream(chatId: string, content: string): Promise<ReadableStream> {
    // Use APIClient for streaming (proxies to backend)
    return APIClient.sendMessageStream(chatId, content)
  }

  static async *parseStreamingResponse(stream: ReadableStream): AsyncGenerator<StreamingResponse> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    logger.info("Starting to parse streaming response", { component: "ai-service" })

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          logger.info("Stream reading completed", { component: "ai-service" })
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              logger.debug("Parsed streaming data", { component: "ai-service", type: data.type })
              yield data as StreamingResponse
            } catch (e) {
              logger.warn("Failed to parse streaming data", { component: "ai-service", line, error: e })
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error reading stream", error as Error, { component: "ai-service" })
      throw error
    } finally {
      reader.releaseLock()
      logger.info("Stream reader released", { component: "ai-service" })
    }
  }

  static async getChatMessages(chatId: string, limit = 50, offset = 0): Promise<any[]> {
    // Use APIClient for simple message fetching (Direct Supabase)
    const data = await APIClient.getChatMessages(chatId, { limit, offset })
    return data.messages || []
  }

  static async updateMessage(messageId: string, content: string): Promise<any> {
    // Use APIClient for simple message updates (Direct Supabase)
    return APIClient.updateMessage(messageId, { content })
  }

  static async deleteMessage(messageId: string): Promise<void> {
    // Use APIClient for simple message deletion (Direct Supabase)
    return APIClient.deleteMessage(messageId)
  }
}
