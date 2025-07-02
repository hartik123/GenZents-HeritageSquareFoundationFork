import type { ShortcutCategory } from "./ui"

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  preferences: UserPreferences
  usage: UsageStats
}

export interface UserPreferences {
  theme: "light" | "dark" | "system"
  language: string
  timezone: string
  notifications: NotificationSettings

  // Chat preferences
  customInstructions?: string
  communicationStyle?: "professional" | "casual" | "friendly" | "balanced" | "technical"
  responseLength?: "concise" | "balanced" | "detailed" | "comprehensive"
  expertiseLevel?: "beginner" | "intermediate" | "advanced" | "expert"
  defaultModel?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  desktop: boolean
  sound: boolean
  mentions: boolean
  replies: boolean
}

export interface UsageStats {
  messagesCount: number
  tokensUsed: number
  filesUploaded: number
  lastActive: string
}

export interface Settings {
  // Theme and appearance
  layoutDensity: string

  // General
  language: string
  showFollowUpSuggestions: boolean
  chats: any[]

  // Chat and AI model settings
  defaultModel: string
  temperature: number
  systemPrompt: string
  maxTokens: number
  customInstructions: string
  communicationStyle: "professional" | "casual" | "friendly" | "balanced" | "technical"
  responseLength: "concise" | "balanced" | "detailed" | "comprehensive"
  expertiseLevel: "beginner" | "intermediate" | "advanced" | "expert"

  // Display preferences
  showTimestamps: boolean
  showWordCount: boolean
  showModelInfo: boolean
  showTokenCount: boolean
  showAvatars: boolean
  compactMode: boolean
  fullScreenMode: boolean

  // Export settings
  exportFormat: string
  includeMetadata: boolean
  includeSystemMessages: boolean

  // Security and privacy
  encryptMessages: boolean
  retentionDays: number
  allowTelemetry: boolean

  // Shortcuts and productivity
  keyboardShortcuts: Record<string, string>
  shortcuts: ShortcutCategory[]
  autoSave: boolean
  autoSaveInterval: number
}

export interface FileItem {
  id: string
  name: string
  type: "file" | "folder"
  size?: number
  extension?: string
  path: string
  lastModified: Date
  category?: string
  tags?: string[]
  preview?: string
}
