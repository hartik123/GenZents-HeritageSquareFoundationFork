import type { Chat, Message } from "./chat"
import type { AIModel } from "./ai"

// Types for advanced search functionality
export interface SearchOptions {
  query: string
  filters: {
    dateRange?: [string, string]
    users?: string[]
    tags?: string[]
    models?: string[]
    fileTypes?: string[]
    sentiment?: "positive" | "negative" | "neutral"
    hasAttachments?: boolean
    isEdited?: boolean
    minTokens?: number
    maxTokens?: number
  }
  sortBy?: "relevance" | "date" | "tokens" | "reactions"
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
}

export interface SearchResult {
  chats: Chat[]
  messages: Message[]
  totalCount: number
  facets: SearchFacets
  suggestions: string[]
}

export interface SearchFacets {
  users: { name: string; count: number }[]
  tags: { name: string; count: number }[]
  models: { name: string; count: number }[]
  dateRanges: { range: string; count: number }[]
}

// Types for AI integration
export interface AIProvider {
  name: string
  apiKey: string
  baseUrl?: string
  models: AIModel[]
}

export interface GenerationOptions {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  stream?: boolean
  systemPrompt?: string
  context?: Message[]
}

// Types for analytics
export interface AnalyticsQuery {
  timeRange: {
    start: string
    end: string
  }
  metrics: string[]
  groupBy?: string[]
  filters?: Record<string, any>
}

export interface AnalyticsResult {
  data: any[]
  summary: {
    totalEvents: number
    uniqueUsers: number
    averageSessionDuration: number
    topEvents: { event: string; count: number }[]
  }
}

// Types for file management
export interface UploadOptions {
  maxSize?: number
  allowedTypes?: string[]
  generateThumbnail?: boolean
  virusScan?: boolean
  encrypt?: boolean
}

// Types for plugin system
export interface PluginAPI {
  // Core API methods available to plugins
  sendMessage: (content: string, options?: any) => Promise<void>
  getCurrentChat: () => any
  getUser: () => any
  showNotification: (message: string, type?: "info" | "success" | "warning" | "error") => void
  registerCommand: (name: string, handler: Function) => void
  registerShortcut: (keys: string[], handler: Function) => void
  addMenuItem: (menu: string, item: any) => void
  storage: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    remove: (key: string) => Promise<void>
  }
}
