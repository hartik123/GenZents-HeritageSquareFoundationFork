export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      chats: {
        Row: {
          id: string
          title: string
          created_at: string
          updated_at: string
          user_id: string
          model?: string
          system_prompt?: string
          tags?: string[]
          bookmarked: boolean
          archived: boolean
          shared: boolean
          collaborators?: string[]
          version: number
          parent_version?: string
        }
        Insert: {
          id: string
          title: string
          created_at?: string
          updated_at?: string
          user_id: string
          model?: string
          system_prompt?: string
          tags?: string[]
          bookmarked?: boolean
          archived?: boolean
          shared?: boolean
          collaborators?: string[]
          version?: number
          parent_version?: string
        }
        Update: {
          id?: string
          title?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          model?: string
          system_prompt?: string
          tags?: string[]
          bookmarked?: boolean
          archived?: boolean
          shared?: boolean
          collaborators?: string[]
          version?: number
          parent_version?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          role: "user" | "assistant" | "system"
          content: string
          created_at: string
          updated_at?: string
          metadata?: Json
          parent_id?: string
        }
        Insert: {
          id: string
          chat_id: string
          role: "user" | "assistant" | "system"
          content: string
          created_at?: string
          updated_at?: string
          metadata?: Json
          parent_id?: string
        }
        Update: {
          id?: string
          chat_id?: string
          role?: "user" | "assistant" | "system"
          content?: string
          created_at?: string
          updated_at?: string
          metadata?: Json
          parent_id?: string
        }
      }
      chat_versions: {
        Row: {
          id: string
          chat_id: string
          version: number
          title: string
          description?: string
          created_at: string
          created_by: string
          data: Json
          tags: string[]
          branch?: string
          parent_version?: string
        }
        Insert: {
          id?: string
          chat_id: string
          version: number
          title: string
          description?: string
          created_at?: string
          created_by: string
          data: Json
          tags?: string[]
          branch?: string
          parent_version?: string
        }
        Update: {
          id?: string
          chat_id?: string
          version?: number
          title?: string
          description?: string
          created_at?: string
          created_by?: string
          data?: Json
          tags?: string[]
          branch?: string
          parent_version?: string
        }
      }
      chat_collaborators: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: "owner" | "editor" | "viewer"
          created_at: string
          invited_by: string
          status: "pending" | "accepted" | "rejected"
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role: "owner" | "editor" | "viewer"
          created_at?: string
          invited_by: string
          status?: "pending" | "accepted" | "rejected"
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: "owner" | "editor" | "viewer"
          created_at?: string
          invited_by?: string
          status?: "pending" | "accepted" | "rejected"
        }
      }
      chat_comments: {
        Row: {
          id: string
          chat_id: string
          message_id: string
          user_id: string
          content: string
          created_at: string
          updated_at?: string
          parent_id?: string
          resolved: boolean
        }
        Insert: {
          id?: string
          chat_id: string
          message_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
          parent_id?: string
          resolved?: boolean
        }
        Update: {
          id?: string
          chat_id?: string
          message_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
          parent_id?: string
          resolved?: boolean
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          theme: "light" | "dark" | "system"
          font_size: "small" | "medium" | "large"
          font_family: string
          compact_mode: boolean
          show_avatars: boolean
          show_timestamps: boolean
          animations_enabled: boolean
          default_model: string
          temperature: number
          max_tokens: number
          system_prompt: string
          auto_save: boolean
          stream_responses: boolean
          data_retention: number
          encrypt_messages: boolean
          allow_analytics: boolean
          share_usage_data: boolean
          desktop_notifications: boolean
          sound_enabled: boolean
          email_notifications: boolean
          language: string
          high_contrast: boolean
          reduced_motion: boolean
          screen_reader_mode: boolean
          message_limit: number
          auto_cleanup: boolean
          cache_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: "light" | "dark" | "system"
          font_size?: "small" | "medium" | "large"
          font_family?: string
          compact_mode?: boolean
          show_avatars?: boolean
          show_timestamps?: boolean
          animations_enabled?: boolean
          default_model?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string
          auto_save?: boolean
          stream_responses?: boolean
          data_retention?: number
          encrypt_messages?: boolean
          allow_analytics?: boolean
          share_usage_data?: boolean
          desktop_notifications?: boolean
          sound_enabled?: boolean
          email_notifications?: boolean
          language?: string
          high_contrast?: boolean
          reduced_motion?: boolean
          screen_reader_mode?: boolean
          message_limit?: number
          auto_cleanup?: boolean
          cache_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: "light" | "dark" | "system"
          font_size?: "small" | "medium" | "large"
          font_family?: string
          compact_mode?: boolean
          show_avatars?: boolean
          show_timestamps?: boolean
          animations_enabled?: boolean
          default_model?: string
          temperature?: number
          max_tokens?: number
          system_prompt?: string
          auto_save?: boolean
          stream_responses?: boolean
          data_retention?: number
          encrypt_messages?: boolean
          allow_analytics?: boolean
          share_usage_data?: boolean
          desktop_notifications?: boolean
          sound_enabled?: boolean
          email_notifications?: boolean
          language?: string
          high_contrast?: boolean
          reduced_motion?: boolean
          screen_reader_mode?: boolean
          message_limit?: number
          auto_cleanup?: boolean
          cache_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string
          avatar_url?: string
          bio?: string
          website?: string
          location?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          avatar_url?: string
          bio?: string
          website?: string
          location?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          avatar_url?: string
          bio?: string
          website?: string
          location?: string
          created_at?: string
          updated_at?: string
        }
      }
      context_files: {
        Row: {
          id: string
          user_id: string
          chat_id?: string
          path: string
          type: "file" | "folder" | "symbol" | "url" | "database"
          content?: string
          metadata?: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chat_id?: string
          path: string
          type: "file" | "folder" | "symbol" | "url" | "database"
          content?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chat_id?: string
          path?: string
          type?: "file" | "folder" | "symbol" | "url" | "database"
          content?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          user_id: string
          message_id?: string
          name: string
          type: string
          size: number
          url: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id?: string
          name: string
          type: string
          size: number
          url: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string
          name?: string
          type?: string
          size?: number
          url?: string
          uploaded_at?: string
        }
      }
      keyboard_shortcuts: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string
          keys: string[]
          category: "chat" | "navigation" | "editing" | "tools"
          action: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description: string
          keys: string[]
          category: "chat" | "navigation" | "editing" | "tools"
          action: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string
          keys?: string[]
          category?: "chat" | "navigation" | "editing" | "tools"
          action?: string
          created_at?: string
          updated_at?: string
        }
      }
      usage_logs: {
        Row: {
          id: string
          user_id: string
          chat_id?: string
          model: string
          tokens: number
          cost: number
          created_at: string
          processing_time: number
          request_type: "chat" | "completion" | "embedding" | "image"
          status: "success" | "error"
          error_message?: string
        }
        Insert: {
          id?: string
          user_id: string
          chat_id?: string
          model: string
          tokens: number
          cost: number
          created_at?: string
          processing_time: number
          request_type: "chat" | "completion" | "embedding" | "image"
          status: "success" | "error"
          error_message?: string
        }
        Update: {
          id?: string
          user_id?: string
          chat_id?: string
          model?: string
          tokens?: number
          cost?: number
          created_at?: string
          processing_time?: number
          request_type?: "chat" | "completion" | "embedding" | "image"
          status?: "success" | "error"
          error_message?: string
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
