export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          theme: "light" | "dark" | "system"
          language: string
          timezone: string
          is_admin: boolean
          status: "active" | "paused" | "pending_invitation"
          permissions: string[]
          invitation_token: string | null
          invitation_expires_at: string | null
          messages_count: number
          tokens_used: number
          files_uploaded: number
          max_storage: number
          max_tokens: number
          max_messages_per_day: number
          max_tasks_per_day: number
          max_api_calls_per_day: number
          last_active: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          theme?: "light" | "dark" | "system"
          language?: string
          timezone?: string
          is_admin?: boolean
          status?: "active" | "paused" | "pending_invitation"
          permissions?: string[]
          invitation_token?: string | null
          invitation_expires_at?: string | null
          messages_count?: number
          tokens_used?: number
          files_uploaded?: number
          max_storage?: number
          max_tokens?: number
          max_messages_per_day?: number
          max_tasks_per_day?: number
          max_api_calls_per_day?: number
          last_active?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          theme?: "light" | "dark" | "system"
          language?: string
          timezone?: string
          is_admin?: boolean
          status?: "active" | "paused" | "pending_invitation"
          permissions?: string[]
          invitation_token?: string | null
          invitation_expires_at?: string | null
          messages_count?: number
          tokens_used?: number
          files_uploaded?: number
          max_storage?: number
          max_tokens?: number
          max_messages_per_day?: number
          max_tasks_per_day?: number
          max_api_calls_per_day?: number
          last_active?: string
          updated_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          title: string
          created_at: string
          updated_at: string
          user_id: string
          metadata: {
            totalMessages: number
            totalTokens: number
            averageResponseTime: number
            lastActivity: string
          }
          context_summary: string
          status: "active" | "archived" | "deleted"
          bookmarked: boolean
          shared_users: string[]
        }
        Insert: {
          title?: string
          user_id: string
          metadata?: {
            totalMessages?: number
            totalTokens?: number
            averageResponseTime?: number
            lastActivity?: string
          }
          context_summary?: string
          status?: "active" | "archived" | "deleted"
          bookmarked?: boolean
          shared_users?: string[]
        }
        Update: {
          title?: string
          user_id?: string
          metadata?: {
            totalMessages?: number
            totalTokens?: number
            averageResponseTime?: number
            lastActivity?: string
          }
          context_summary?: string
          status?: "active" | "archived" | "deleted"
          bookmarked?: boolean
          shared_users?: string[]
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          user_id: string | null
          role: "user" | "assistant" | "system" | "function"
          content: string
          created_at: string
          updated_at: string
          deleted: boolean
          metadata: {
            tokens?: number
            cost?: number
            processingTime?: number
            confidence?: number
            citations?: Array<{
              text: string
              source: string
              type: "url" | "document" | "knowledge_base"
              page?: number
              line?: number
            }>
            language?: string
            sentiment?: "positive" | "negative" | "neutral"
            isTaskNotification?: boolean
            taskId?: string
            commandData?: any
          }
          sent: boolean
          delivered: boolean
          read: boolean
          error_message: string | null
          retries: number
          status: "sending" | "sent" | "delivered" | "read" | "error"
          tokens: number | null
          cost: number | null
          processing_time: number | null
          confidence: number | null
          language: string | null
          sentiment: "positive" | "negative" | "neutral" | null
        }
        Insert: {
          chat_id: string
          user_id?: string | null
          role: "user" | "assistant" | "system" | "function"
          content: string
          deleted?: boolean
          metadata?: {
            tokens?: number
            cost?: number
            processingTime?: number
            confidence?: number
            citations?: Array<{
              text: string
              source: string
              type: "url" | "document" | "knowledge_base"
              page?: number
              line?: number
            }>
            language?: string
            sentiment?: "positive" | "negative" | "neutral"
            isTaskNotification?: boolean
            taskId?: string
            commandData?: any
          }
          sent?: boolean
          delivered?: boolean
          read?: boolean
          error_message?: string | null
          retries?: number
          status?: "sending" | "sent" | "delivered" | "read" | "error"
          tokens?: number | null
          cost?: number | null
          processing_time?: number | null
          confidence?: number | null
          language?: string | null
          sentiment?: "positive" | "negative" | "neutral" | null
        }
        Update: {
          chat_id?: string
          user_id?: string | null
          role?: "user" | "assistant" | "system" | "function"
          content?: string
          deleted?: boolean
          metadata?: {
            tokens?: number
            cost?: number
            processingTime?: number
            confidence?: number
            citations?: Array<{
              text: string
              source: string
              type: "url" | "document" | "knowledge_base"
              page?: number
              line?: number
            }>
            language?: string
            sentiment?: "positive" | "negative" | "neutral"
            isTaskNotification?: boolean
            taskId?: string
            commandData?: any
          }
          sent?: boolean
          delivered?: boolean
          read?: boolean
          error_message?: string | null
          retries?: number
          status?: "sending" | "sent" | "delivered" | "read" | "error"
          tokens?: number | null
          cost?: number | null
          processing_time?: number | null
          confidence?: number | null
          language?: string | null
          sentiment?: "positive" | "negative" | "neutral" | null
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          message_id: string | null
          chat_id: string | null
          name: string
          type: string
          size: number
          content: string | null
          checksum: string
          scanned: boolean
          clean: boolean
          threats: string[]
          scanned_at: string | null
          created_at: string
        }
        Insert: {
          message_id?: string | null
          chat_id?: string | null
          name: string
          type: string
          size: number
          content?: string | null
          checksum: string
          scanned?: boolean
          clean?: boolean
          threats?: string[]
          scanned_at?: string | null
        }
        Update: {
          message_id?: string | null
          chat_id?: string | null
          name?: string
          type?: string
          size?: number
          content?: string | null
          checksum?: string
          scanned?: boolean
          clean?: boolean
          threats?: string[]
          scanned_at?: string | null
        }
      }
      analytics: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          event: string
          properties: any
          timestamp: string
        }
        Insert: {
          user_id?: string | null
          session_id?: string | null
          event: string
          properties?: any
          timestamp?: string
        }
        Update: {
          user_id?: string | null
          session_id?: string | null
          event?: string
          properties?: any
          timestamp?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          chat_id: string | null
          command_id: string
          parameters: any
          status: "pending" | "running" | "completed" | "failed" | "cancelled"
          progress: number
          result: any | null
          error_message: string | null
          logs: string[]
          created_at: string
          started_at: string | null
          completed_at: string | null
          estimated_duration: number | null
          priority: number
          retry_count: number
          updated_at: string
        }
        Insert: {
          user_id: string
          chat_id?: string | null
          command_id: string
          parameters?: any
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          progress?: number
          result?: any | null
          error_message?: string | null
          logs?: string[]
          started_at?: string | null
          completed_at?: string | null
          estimated_duration?: number | null
          priority?: number
          retry_count?: number
        }
        Update: {
          user_id?: string
          chat_id?: string | null
          command_id?: string
          parameters?: any
          status?: "pending" | "running" | "completed" | "failed" | "cancelled"
          progress?: number
          result?: any | null
          error_message?: string | null
          logs?: string[]
          started_at?: string | null
          completed_at?: string | null
          estimated_duration?: number | null
          priority?: number
          retry_count?: number
          updated_at?: string
        }
      }
      versions: {
        Row: {
          id: string
          version: string
          title: string
          description: string
          user_id: string
          timestamp: string
          created_at: string
          data: any | null
        }
        Insert: {
          version: string
          title: string
          description: string
          user_id: string
          timestamp: string
          status?: "current" | "previous" | "archived"
          data?: any | null
        }
        Update: {
          version?: string
          title?: string
          description?: string
          user_id?: string
          timestamp?: string
          status?: "current" | "previous" | "archived"
          data?: any | null
        }
      }
      commands: {
        Row: {
          id: string
          name: string
          description: string
          pattern: string
          instruction: string
          enabled: boolean
          user_id: string | null
          type: "system" | "admin" | "user"
          created_at: string
        }
        Insert: {
          name: string
          description: string
          pattern: string
          instruction: string
          enabled?: boolean
          user_id?: string | null
          type: "system" | "admin" | "user"
        }
        Update: {
          name?: string
          description?: string
          pattern?: string
          instruction?: string
          enabled?: boolean
          user_id?: string | null
          type?: "system" | "admin" | "user"
        }
      }
      changes: {
        Row: {
          id: string
          version_id: string
          type: "added" | "modified" | "deleted"
          original_path: string
          new_path: string | null
          original_value: any | null
          new_value: any | null
          description: string | null
          command_id: string | null
          user_id: string | null
          timestamp: string
        }
        Insert: {
          version_id: string
          type: "added" | "modified" | "deleted"
          original_path: string
          new_path?: string | null
          original_value?: any | null
          new_value?: any | null
          description?: string | null
          command_id?: string | null
          user_id?: string | null
          timestamp: string
        }
        Update: {
          version_id?: string
          type?: "added" | "modified" | "deleted"
          original_path?: string
          new_path?: string | null
          original_value?: any | null
          new_value?: any | null
          description?: string | null
          command_id?: string | null
          user_id?: string | null
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
