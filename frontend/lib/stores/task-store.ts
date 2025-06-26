import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Task, TaskStats, TaskFilterOptions, TaskStore as TaskStoreInterface } from "@/lib/types/tasks"

const supabase = createClient()

interface InternalTaskStore extends TaskStoreInterface {
  subscriptionCleanup?: () => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const useTaskStore = create<InternalTaskStore>((set, get) => ({
  tasks: [],
  taskStats: {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
  },
  loading: false,
  error: null,

  fetchTasks: async (filters?: TaskFilterOptions) => {
    try {
      set({ loading: true, error: null })

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No authentication session")
      }

      let url = `${API_BASE}/api/tasks/`
      if (filters) {
        const params = new URLSearchParams()
        if (filters.status) params.append("status", filters.status.join(","))
        if (filters.type) params.append("type", filters.type.join(","))
        if (filters.chat_id) params.append("chat_id", filters.chat_id)
        if (filters.limit) params.append("limit", filters.limit.toString())
        if (filters.offset) params.append("offset", filters.offset.toString())

        if (params.toString()) {
          url += `?${params.toString()}`
        }
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`)
      }

      const data = await response.json()
      set({ tasks: data.tasks || [], loading: false })

      // Update stats
      await get().fetchTaskStats()
    } catch (error) {
      logger.error("Error fetching tasks", error as Error, { component: "task-store" })
      set({ error: (error as Error).message, loading: false })
    }
  },

  fetchTaskStats: async () => {
    try {
      const tasks = get().tasks
      const stats: TaskStats = tasks.reduce(
        (acc, task) => {
          acc[task.status]++
          acc.total++
          return acc
        },
        {
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          total: 0,
        }
      )

      set({ taskStats: stats })
    } catch (error) {
      logger.error("Error calculating task stats", error as Error, { component: "task-store" })
    }
  },

  cancelTask: async (taskId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No authentication session")
      }

      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "User requested cancellation" }),
      })

      if (!response.ok) {
        throw new Error(`Failed to cancel task: ${response.statusText}`)
      }

      // Refresh tasks list
      await get().fetchTasks()

      return true
    } catch (error) {
      logger.error("Error cancelling task", error as Error, { component: "task-store" })
      set({ error: (error as Error).message })
      return false
    }
  },

  deleteTask: async (taskId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No authentication session")
      }

      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`)
      }

      // Remove from local state
      set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== taskId),
      }))

      return true
    } catch (error) {
      logger.error("Error deleting task", error as Error, { component: "task-store" })
      set({ error: (error as Error).message })
      return false
    }
  },

  getTask: async (taskId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No authentication session")
      }

      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      logger.error("Error fetching task", error as Error, { component: "task-store" })
      return null
    }
  },

  subscribeToTasks: () => {
    // Subscribe to real-time updates from Supabase
    const subscription = supabase
      .channel("tasks")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          // Refresh tasks when changes occur
          get().fetchTasks()
        }
      )
      .subscribe()

    // Store cleanup function
    set({ subscriptionCleanup: () => subscription.unsubscribe() })

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe()
    }
  },

  refreshTask: async (taskId: string) => {
    try {
      const task = await get().getTask(taskId)
      if (task) {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? task : t)),
        }))
      }
    } catch (error) {
      logger.error("Error refreshing task", error as Error, { component: "task-store" })
    }
  },
}))
