// Types for rate limiting
export interface RateLimitOptions {
  windowMs: number
  max: number
  message: string
  standardHeaders: boolean
  legacyHeaders: boolean
}

export interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

// Types for password validation
export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

// Types for performance monitoring
export interface PerformanceMetrics {
  avg: number
  min: number
  max: number
  count: number
}

// Types for internationalization
export type TranslationDictionary = Record<string, Record<string, string>>

export interface I18nConfig {
  defaultLanguage: string
  supportedLanguages: string[]
  fallbackLanguage: string
}

// Types for advanced search functionality
export interface SearchOptions {
  query: string
  filters: {
    dateRange?: [string, string]
    users?: string[]
    keywords?: string[]
    hasAttachments?: boolean
  }
  sortBy?: "relevance" | "date" | "tokens"
  sortOrder?: "asc" | "desc"
}

export interface GenerationOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  systemPrompt?: string
}

// Settings

export interface Settings {
  // General
  language: string
  showFollowUpSuggestions: boolean
  chats: any[]
  // Chat and AI model settings
  temperature: number
  systemPrompt: string
  maxTokens: number
  customInstructions: string
  communicationStyle: "professional" | "casual" | "friendly" | "balanced" | "technical"
  responseLength: "concise" | "balanced" | "detailed" | "comprehensive"
  // Display preferences
  showTimestamps: boolean
  showTokenCount: boolean
  showAvatars: boolean
  compactMode: boolean
  fullScreenMode: boolean
  // Export settings
  exportFormat: string
  includeMetadata: boolean
  // Security and privacy
  encryptMessages: boolean
  retentionDays: number
}
