import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { UserPreferences, ChatContext, EnhancedMessageContext, Message } from "@/lib/types/chat"
import type { Settings } from "@/lib/types/user"

export class ContextService {
  private static instance: ContextService
  private supabase = createClient()

  private constructor() {}

  static getInstance(): ContextService {
    if (!ContextService.instance) {
      ContextService.instance = new ContextService()
    }
    return ContextService.instance
  }

  /**
   * Get user preferences for enhanced context processing
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const { data: settings, error } = await this.supabase
        .from("user_settings")
        .select(
          "custom_instructions, communication_style, response_length, expertise_level, " +
            "default_model, temperature, max_tokens, system_prompt"
        )
        .eq("user_id", userId)
        .single()

      if (error) {
        logger.warn("Failed to fetch user preferences, using defaults", { error })
        return this.getDefaultPreferences()
      }

      if (!settings) {
        return this.getDefaultPreferences()
      }

      return {
        customInstructions: (settings as any).custom_instructions || "",
        communicationStyle: (settings as any).communication_style || "balanced",
        responseLength: (settings as any).response_length || "balanced",
        expertiseLevel: (settings as any).expertise_level || "intermediate",
        defaultModel: (settings as any).default_model || "gpt-4",
        temperature: (settings as any).temperature || 0.7,
        maxTokens: (settings as any).max_tokens || 2048,
        systemPrompt: (settings as any).system_prompt || "",
      }
    } catch (error) {
      logger.error("Error fetching user preferences", error as Error)
      return this.getDefaultPreferences()
    }
  }

  /**
   * Get chat context summary and recent messages
   */
  async getChatContext(chatId: string, userId: string): Promise<ChatContext> {
    try {
      // Get chat summary
      const { data: chat, error: chatError } = await this.supabase
        .from("chats")
        .select("context_summary, last_context_update, context_version")
        .eq("id", chatId)
        .eq("user_id", userId)
        .single()

      if (chatError) {
        throw chatError
      }

      // Get recent messages (last 5)
      const { data: messages, error: messagesError } = await this.supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .eq("deleted", false)
        .order("created_at", { ascending: false })
        .limit(5)

      if (messagesError) {
        throw messagesError
      }

      // Get user preferences
      const userPreferences = await this.getUserPreferences(userId)

      return {
        summary: chat?.context_summary || "",
        lastMessages: messages?.reverse() || [], // Reverse to get chronological order
        userPreferences,
        lastUpdated: chat?.last_context_update || new Date().toISOString(),
        version: chat?.context_version || 1,
      }
    } catch (error) {
      logger.error("Error fetching chat context", error as Error, { chatId, userId })
      return {
        summary: "",
        lastMessages: [],
        userPreferences: this.getDefaultPreferences(),
        lastUpdated: new Date().toISOString(),
        version: 1,
      }
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const updateData: any = {}

      if (preferences.customInstructions !== undefined) {
        updateData.custom_instructions = preferences.customInstructions
      }
      if (preferences.communicationStyle !== undefined) {
        updateData.communication_style = preferences.communicationStyle
      }
      if (preferences.responseLength !== undefined) {
        updateData.response_length = preferences.responseLength
      }
      if (preferences.expertiseLevel !== undefined) {
        updateData.expertise_level = preferences.expertiseLevel
      }
      if (preferences.defaultModel !== undefined) {
        updateData.default_model = preferences.defaultModel
      }
      if (preferences.temperature !== undefined) {
        updateData.temperature = preferences.temperature
      }
      if (preferences.maxTokens !== undefined) {
        updateData.max_tokens = preferences.maxTokens
      }
      if (preferences.systemPrompt !== undefined) {
        updateData.system_prompt = preferences.systemPrompt
      }

      updateData.updated_at = new Date().toISOString()

      const { error } = await this.supabase.from("user_settings").upsert({
        user_id: userId,
        ...updateData,
      })

      if (error) {
        throw error
      }

      logger.info("User preferences updated successfully", { userId })
    } catch (error) {
      logger.error("Error updating user preferences", error as Error, { userId })
      throw error
    }
  }

  /**
   * Get enhanced message context for AI processing
   */
  async getEnhancedMessageContext(
    chatId: string,
    userId: string,
    userMessage: string
  ): Promise<EnhancedMessageContext> {
    try {
      const context = await this.getChatContext(chatId, userId)

      // Create enhanced system prompt
      const systemPrompt = this.buildEnhancedSystemPrompt(context.userPreferences, context.summary)

      // Add current user message to history
      const currentMessage: Message = {
        id: "", // Will be set by backend
        chat_id: chatId,
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
        edited: false,
        deleted: false,
        metadata: {},
        attachments: [],
        reactions: [],
        mentions: [],
        status: {
          sent: true,
          delivered: true,
          read: false,
          retries: 0,
          status: "sent",
        },
        encryption: { encrypted: false },
      }

      return {
        systemPrompt,
        messageHistory: [...context.lastMessages, currentMessage],
        userPreferences: context.userPreferences,
        contextSummary: context.summary,
      }
    } catch (error) {
      logger.error("Error getting enhanced message context", error as Error, { chatId, userId })
      throw error
    }
  }

  /**
   * Build enhanced system prompt with user preferences and context
   */
  private buildEnhancedSystemPrompt(preferences: UserPreferences, contextSummary: string): string {
    const parts = []

    // Base system prompt
    if (preferences.systemPrompt) {
      parts.push(preferences.systemPrompt)
    }

    // Communication style instructions
    const styleInstructions = this.getStyleInstructions(preferences)
    if (styleInstructions) {
      parts.push(styleInstructions)
    }

    // Custom instructions
    if (preferences.customInstructions) {
      parts.push(`User's custom instructions: ${preferences.customInstructions}`)
    }

    // Context summary
    if (contextSummary) {
      parts.push(`Conversation context: ${contextSummary}`)
    }

    return parts.join("\n\n")
  }

  /**
   * Generate style instructions based on user preferences
   */
  private getStyleInstructions(preferences: UserPreferences): string {
    const styleMap = {
      professional: "Maintain a professional, formal tone. Be precise and comprehensive.",
      casual: "Use a casual, friendly tone. Be conversational and approachable.",
      friendly: "Be warm, encouraging, and supportive. Use positive language.",
      balanced: "Use a balanced tone that's professional yet approachable.",
      technical: "Use precise technical language. Be detailed and accurate.",
    }

    const lengthMap = {
      concise: "Keep responses brief and to the point.",
      balanced: "Provide moderately detailed responses.",
      detailed: "Provide comprehensive, detailed explanations.",
      comprehensive: "Provide thorough, in-depth responses with examples.",
    }

    const levelMap = {
      beginner: "Explain concepts simply, avoiding jargon. Provide basic examples.",
      intermediate: "Use moderate complexity. Explain key concepts clearly.",
      advanced: "Use advanced terminology. Assume good background knowledge.",
      expert: "Use expert-level language and concepts.",
    }

    const instructions = []

    if (preferences.communicationStyle && styleMap[preferences.communicationStyle]) {
      instructions.push(styleMap[preferences.communicationStyle])
    }

    if (preferences.responseLength && lengthMap[preferences.responseLength]) {
      instructions.push(lengthMap[preferences.responseLength])
    }

    if (preferences.expertiseLevel && levelMap[preferences.expertiseLevel]) {
      instructions.push(levelMap[preferences.expertiseLevel])
    }

    return instructions.join(" ")
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      customInstructions: "",
      communicationStyle: "balanced",
      responseLength: "balanced",
      expertiseLevel: "intermediate",
      defaultModel: "gpt-4",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: "",
    }
  }

  /**
   * Convert frontend Settings to UserPreferences
   */
  settingsToPreferences(settings: Settings): UserPreferences {
    return {
      customInstructions: settings.customInstructions || "",
      communicationStyle: settings.communicationStyle,
      responseLength: settings.responseLength,
      expertiseLevel: settings.expertiseLevel,
      defaultModel: settings.defaultModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
    }
  }

  /**
   * Convert UserPreferences to frontend Settings (partial update)
   */
  preferencesToSettings(preferences: UserPreferences): Partial<Settings> {
    return {
      customInstructions: preferences.customInstructions,
      communicationStyle: preferences.communicationStyle,
      responseLength: preferences.responseLength,
      expertiseLevel: preferences.expertiseLevel,
      defaultModel: preferences.defaultModel,
      temperature: preferences.temperature,
      maxTokens: preferences.maxTokens,
      systemPrompt: preferences.systemPrompt,
    }
  }
}

export const contextService = ContextService.getInstance()
