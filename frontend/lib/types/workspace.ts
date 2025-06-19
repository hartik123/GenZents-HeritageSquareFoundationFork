import { Permission, ChatSettings } from "./chat"

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
