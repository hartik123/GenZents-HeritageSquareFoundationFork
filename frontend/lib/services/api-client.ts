// API Client Service - Separates Frontend API routes from Backend API calls
// This service follows the documented API architecture:
// - Frontend APIs: Simple CRUD, monitoring, polling (Direct Supabase)
// - Backend APIs: Computation-heavy, AI processing, complex operations

import { logger } from "@/lib/utils/logger"

export class APIClient {
  private static backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

  // ===== FRONTEND API ROUTES (Direct Supabase) =====

  // Chats Management
  static async getChats(params?: { archived?: boolean; bookmarked?: boolean; limit?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.archived !== undefined) searchParams.set("archived", String(params.archived))
    if (params?.bookmarked !== undefined) searchParams.set("bookmarked", String(params.bookmarked))
    if (params?.limit) searchParams.set("limit", String(params.limit))

    const response = await fetch(`/api/chats?${searchParams}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch chats")
    }
    return response.json()
  }

  static async createChat(data: { title: string; model?: string; system_prompt?: string; tags?: string[] }) {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create chat")
    }
    return response.json()
  }

  static async updateChat(chatId: string, data: { title?: string; archived?: boolean; bookmarked?: boolean }) {
    const response = await fetch(`/api/chats/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update chat")
    }
    return response.json()
  }

  static async deleteChat(chatId: string) {
    const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete chat")
    }
  }

  // Messages Fetching
  static async getChatMessages(chatId: string, params?: { limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set("limit", String(params.limit))
    if (params?.offset) searchParams.set("offset", String(params.offset))

    const response = await fetch(`/api/chats/${chatId}/messages?${searchParams}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch messages")
    }
    return response.json()
  }

  static async getMessage(messageId: string) {
    const response = await fetch(`/api/messages/${messageId}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch message")
    }
    return response.json()
  }

  static async updateMessage(messageId: string, data: { content: string }) {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update message")
    }
    return response.json()
  }

  static async deleteMessage(messageId: string) {
    const response = await fetch(`/api/messages/${messageId}`, { method: "DELETE" })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete message")
    }
  }

  // Tasks Monitoring
  static async getTasks(params?: { status?: string; task_type?: string; page?: number; per_page?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set("status", params.status)
    if (params?.task_type) searchParams.set("task_type", params.task_type)
    if (params?.page) searchParams.set("page", String(params.page))
    if (params?.per_page) searchParams.set("per_page", String(params.per_page))

    const response = await fetch(`/api/tasks?${searchParams}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch tasks")
    }
    return response.json()
  }

  static async getTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch task")
    }
    return response.json()
  }

  static async updateTask(
    taskId: string,
    data: { status?: string; progress?: number; result?: any; error_message?: string }
  ) {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update task")
    }
    return response.json()
  }

  static async deleteTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete task")
    }
  }

  // Analytics & Monitoring
  static async getUsageAnalytics() {
    const response = await fetch("/api/analytics/usage")
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch analytics")
    }
    return response.json()
  }

  // ===== BACKEND API PROXIES (Computation-Heavy) =====

  // AI Processing
  static async sendMessage(chatId: string, message: string) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to send message")
    }
    return response.json()
  }

  static async sendMessageStream(chatId: string, message: string): Promise<ReadableStream> {
    const token = await this.getAuthToken()
    if (!token) {
      throw new Error("User not authenticated")
    }

    const response = await fetch(`${this.backendURL}/api/messages/chat/${chatId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: message, role: "user" }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to start message stream")
    }

    return response.body!
  }

  // Task Operations (Computation-Heavy)
  static async createTask(data: {
    type: string
    command: string
    chat_id?: string
    priority?: number
    parameters?: any
    estimated_duration?: number
    max_retries?: number
  }) {
    const response = await fetch("/api/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create task")
    }
    return response.json()
  }

  static async cancelTask(taskId: string, reason?: string) {
    const response = await fetch(`/api/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to cancel task")
    }
    return response.json()
  }

  static async processCommand(command: string, chatId?: string, priority?: number) {
    const response = await fetch("/api/tasks/process-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, chat_id: chatId, priority }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to process command")
    }
    return response.json()
  }

  // ===== UTILITY METHODS =====

  private static async getAuthToken(): Promise<string | null> {
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      logger.error("Failed to get auth token", error as Error, { component: "api-client" })
      return null
    }
  }
}
