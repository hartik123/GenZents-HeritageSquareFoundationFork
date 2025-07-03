import { supabase } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Database } from "@/lib/types/database"
import type { Settings } from "@/lib/types/utils"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Message = Database["public"]["Tables"]["messages"]["Row"]

interface ChatContext {
  summary: string
  lastMessages: Message[]
  lastUpdated: string
}

export class ContextService {
  private static instance: ContextService

  private constructor() {}

  static getInstance(): ContextService {
    if (!ContextService.instance) {
      ContextService.instance = new ContextService()
    }
    return ContextService.instance
  }

  async getUserProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (error) {
        logger.warn("Failed to fetch user profile", { error, userId })
        return null
      }

      return data
    } catch (error) {
      logger.error("Error fetching user profile", error as Error)
      return null
    }
  }

  async getChatContext(chatId: string, userId: string): Promise<ChatContext> {
    try {
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .select("context_summary, created_at")
        .eq("id", chatId)
        .eq("user_id", userId)
        .single()

      if (chatError) {
        throw chatError
      }

      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .eq("deleted", false)
        .order("created_at", { ascending: false })
        .limit(10)

      if (messagesError) {
        throw messagesError
      }

      return {
        summary: chat?.context_summary || "",
        lastMessages: messages?.reverse() || [],
        lastUpdated: chat?.created_at || new Date().toISOString(),
      }
    } catch (error) {
      logger.error("Error fetching chat context", error as Error, { chatId, userId })
      return {
        summary: "",
        lastMessages: [],
        lastUpdated: new Date().toISOString(),
      }
    }
  }

  async updateChatContext(chatId: string, summary: string): Promise<void> {
    try {
      const { error } = await supabase.from("chats").update({ context_summary: summary }).eq("id", chatId)

      if (error) {
        throw error
      }

      logger.info("Chat context updated successfully", { chatId })
    } catch (error) {
      logger.error("Error updating chat context", error as Error, { chatId })
      throw error
    }
  }

  buildSystemPrompt(settings: Partial<Settings> = {}): string {
    const parts = []

    if (settings.systemPrompt) {
      parts.push(settings.systemPrompt)
    }

    if (settings.customInstructions) {
      parts.push(`User instructions: ${settings.customInstructions}`)
    }

    const styleInstructions = this.getStyleInstructions(settings)
    if (styleInstructions) {
      parts.push(styleInstructions)
    }

    return parts.join("\n\n") || "You are a helpful AI assistant."
  }

  private getStyleInstructions(settings: Partial<Settings>): string {
    const instructions = []

    if (settings.communicationStyle === "professional") {
      instructions.push("Use a professional, formal tone.")
    } else if (settings.communicationStyle === "casual") {
      instructions.push("Use a casual, friendly tone.")
    } else if (settings.communicationStyle === "technical") {
      instructions.push("Use precise technical language.")
    }

    if (settings.responseLength === "concise") {
      instructions.push("Keep responses brief.")
    } else if (settings.responseLength === "detailed") {
      instructions.push("Provide detailed explanations.")
    }

    return instructions.join(" ")
  }
}

export const contextService = ContextService.getInstance()
