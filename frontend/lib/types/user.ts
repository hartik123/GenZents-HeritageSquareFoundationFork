export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  preferences: UserPreferences
  permissions: UserPermission[]
  status: UserStatus
  constraints: UserConstraints
  customCommands?: string[]
  usage: UsageStats
}

export interface UserPreferences {
  theme: "light" | "dark" | "system"
  language: string
  timezone: string
  notifications: NotificationSettings
  communicationStyle?: "professional" | "casual" | "friendly" | "balanced" | "technical"
  responseLength?: "concise" | "balanced" | "detailed" | "comprehensive"
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  desktop: boolean
  sound: boolean
}

export interface UsageStats {
  messagesCount: number
  tokensUsed: number
  tasksInitiated: number
  lastActive: string
  totalStorageUsed: number
  apiCalls: number
}

export type UserPermission =
  | "ai_chat"
  | "file_organization"
  | "version_history"
  | "context_management"
  | "tools_access"
  | "admin_access"

export type UserStatus = "active" | "paused" | "pending_invitation"

export interface UserConstraints {
  maxStorage: number
  maxTokens: number
  maxMessagesPerDay: number
  maxTasksPerDay: number
  maxApiCallsPerDay: number
}