export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  preferences: UserPreferences
  subscription: SubscriptionTier
  usage: UsageStats
}

export interface UserPreferences {
  theme: "light" | "dark" | "system"
  language: string
  timezone: string
  notifications: NotificationSettings
  privacy: PrivacySettings
  accessibility: AccessibilitySettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  desktop: boolean
  sound: boolean
  mentions: boolean
  replies: boolean
}

export interface PrivacySettings {
  profileVisibility: "public" | "private" | "friends"
  dataSharing: boolean
  analytics: boolean
  marketing: boolean
}

export interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  screenReader: boolean
  fontSize: "small" | "medium" | "large" | "xl"
  keyboardNavigation: boolean
}

export interface SubscriptionTier {
  plan: "free" | "pro" | "enterprise"
  features: string[]
  limits: UsageLimits
  billing: BillingInfo
}

export interface UsageLimits {
  messagesPerDay: number
  tokensPerMonth: number
  fileUploads: number
  collaborators: number
  customModels: number
}

export interface BillingInfo {
  amount: number
  currency: string
  interval: "monthly" | "yearly"
  nextBilling: string
}

export interface UsageStats {
  messagesCount: number
  tokensUsed: number
  filesUploaded: number
  collaborations: number
  lastActive: string
}

export interface Chat {
  id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
  user_id: string
  collaborators: Collaborator[]
  settings: ChatSettings
  metadata: ChatMetadata
  messages: Message[]
  versions: ChatVersion[]
  tags: string[]
  category: string
  status: "active" | "archived" | "deleted"
  visibility: "private" | "shared" | "public"
  template: boolean
  attachments: Attachment[]
  contextFiles: ContextFile[]
}

export interface ChatSettings {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  contextWindow: number
  streaming: boolean
  autoSave: boolean
  encryption: boolean
  retentionDays: number
}

export interface ChatMetadata {
  totalMessages: number
  totalTokens: number
  averageResponseTime: number
  lastActivity: string
  participants: string[]
  language: string
  domain: string
}

export interface Collaborator {
  user_id: string
  role: "owner" | "editor" | "viewer" | "commenter"
  permissions: Permission[]
  invited_at: string
  accepted_at?: string
  status: "pending" | "active" | "inactive"
}

export interface Permission {
  action: string
  resource: string
  granted: boolean
}

export interface Message {
  id: string
  chat_id: string
  user_id: string
  role: "user" | "assistant" | "system" | "function"
  content: string
  created_at: string
  updated_at?: string
  edited: boolean
  deleted: boolean
  metadata: MessageMetadata
  attachments: Attachment[]
  reactions: Reaction[]
  mentions: Mention[]
  thread_id?: string
  parent_id?: string
  status: MessageStatus
  encryption: EncryptionInfo
}

export interface MessageMetadata {
  model?: string
  tokens?: number
  cost?: number
  processingTime?: number
  confidence?: number
  sources?: Source[]
  citations?: Citation[]
  language?: string
  sentiment?: "positive" | "negative" | "neutral"
  topics?: string[]
  entities?: Entity[]
}

export interface MessageStatus {
  sent: boolean
  delivered: boolean
  read: boolean
  error?: string
  retries: number
}

export interface EncryptionInfo {
  encrypted: boolean
  algorithm?: string
  keyId?: string
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  thumbnail?: string
  metadata: AttachmentMetadata
  virus_scan: VirusScanResult
  created_at: string
}

export interface AttachmentMetadata {
  width?: number
  height?: number
  duration?: number
  pages?: number
  encoding?: string
  checksum: string
}

export interface VirusScanResult {
  scanned: boolean
  clean: boolean
  threats?: string[]
  scanned_at: string
}

export interface Reaction {
  id: string
  user_id: string
  type: string
  emoji: string
  created_at: string
}

export interface Mention {
  id: string
  user_id: string
  start: number
  end: number
  type: "user" | "channel" | "file" | "url"
}

export interface Source {
  url: string
  title: string
  description: string
  domain: string
  confidence: number
}

export interface Citation {
  text: string
  source: string
  page?: number
  line?: number
}

export interface Entity {
  text: string
  type: string
  confidence: number
  start: number
  end: number
}

export interface ChatVersion {
  id: string
  version: number
  title: string
  description: string
  created_at: string
  created_by: string
  changes: VersionChange[]
  parent_version?: string
  branch: string
  tags: string[]
}

export interface VersionChange {
  type: "added" | "modified" | "deleted"
  resource: "message" | "setting" | "metadata"
  resource_id: string
  old_value?: any
  new_value?: any
}

export interface AIModel {
  id: string
  name: string
  provider: string
  type: "text" | "image" | "audio" | "video" | "multimodal"
  capabilities: ModelCapability[]
  pricing: ModelPricing
  limits: ModelLimits
  status: "active" | "deprecated" | "beta"
  description: string
}

export interface ModelCapability {
  name: string
  supported: boolean
  quality: "low" | "medium" | "high" | "excellent"
}

export interface ModelPricing {
  input_cost: number
  output_cost: number
  currency: string
  unit: string
}

export interface ModelLimits {
  max_tokens: number
  max_requests_per_minute: number
  max_requests_per_day: number
  context_window: number
}

export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  category: string
  permissions: string[]
  settings: PluginSettings
  enabled: boolean
  installed_at: string
}

export interface PluginSettings {
  [key: string]: any
}

export interface Workspace {
  id: string
  name: string
  description: string
  owner_id: string
  members: WorkspaceMember[]
  settings: WorkspaceSettings
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  user_id: string
  role: "admin" | "member" | "guest"
  permissions: Permission[]
  joined_at: string
}

export interface WorkspaceSettings {
  visibility: "private" | "public"
  allowInvites: boolean
  defaultChatSettings: ChatSettings
  branding: BrandingSettings
}

export interface BrandingSettings {
  logo?: string
  primaryColor: string
  secondaryColor: string
  customCSS?: string
}

export interface Analytics {
  user_id: string
  workspace_id?: string
  event: string
  properties: Record<string, any>
  timestamp: string
  session_id: string
  ip_address?: string
  user_agent?: string
}

export interface APIKey {
  id: string
  name: string
  key: string
  user_id: string
  permissions: string[]
  rate_limit: number
  expires_at?: string
  last_used?: string
  created_at: string
}

export interface Integration {
  id: string
  name: string
  type: string
  config: IntegrationConfig
  enabled: boolean
  user_id: string
  workspace_id?: string
}

export interface IntegrationConfig {
  [key: string]: any
}

export interface ContextFile {
  id: string
  name: string
  type: string
  size: number
  path: string
  content?: string
  added_at: string
}
