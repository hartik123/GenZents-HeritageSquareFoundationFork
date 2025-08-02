export interface Chat {
  id: string
  title: string
  created_at: Date
  user_id: string
  metadata: ChatMetadata
  context_summary: string
  status: "active" | "archived" | "deleted"
  attachments?: Attachment[]
  bookmarked?: boolean
  shared_users?: string[]
}

export interface ChatMetadata {
  totalMessages: number
  totalTokens: number
  averageResponseTime: number
  lastActivity: string
}

export interface Message {
  id: string
  chat_id: string
  user_id?: string
  role: "user" | "assistant" | "system" | "function"
  content: string
  created_at: Date
  updated_at: Date
  deleted: boolean
  metadata: MessageMetadata
  status: MessageStatus
  reactions?: Reaction[]
}

export interface MessageMetadata {
  tokens?: number
  cost?: number
  processingTime?: number
  confidence?: number
  citations?: Citation[]
  language?: string
  sentiment?: "positive" | "negative" | "neutral"
  isTaskNotification?: boolean
  taskId?: string
  commandData?: any
}

export interface Citation {
  text: string
  source: string
  type: "url" | "document" | "knowledge_base"
  page?: number
  line?: number
}

export interface MessageStatus {
  sent: boolean
  delivered: boolean
  read: boolean
  error?: string
  retries: number
  status?: "sending" | "sent" | "delivered" | "read" | "error"
}

export interface Reaction {
  id: string,
  user_id: string
  type: "liked" | "disliked" | "flagged"
  created_at: string
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  virus_scan: VirusScanResult
  created_at: string
  content?: string
  contextSummary?: string
}

export interface VirusScanResult {
  scanned: boolean
  clean: boolean
  threats?: string[]
  scanned_at: string
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  systemPrompt?: string
}
