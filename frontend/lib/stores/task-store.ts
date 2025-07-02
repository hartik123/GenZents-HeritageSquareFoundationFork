import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { Task, TaskStats, TaskFilterOptions, TaskStore as TaskStoreInterface } from "@/lib/types/tasks"

const supabase = createClient()

interface InternalTaskStore extends TaskStoreInterface {
  subscriptionCleanup?: () => void
}

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

      // Build query based on filters
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (filters?.status && filters.status.length > 0) {
        query = query.in("status", filters.status)
      }
      if (filters?.type && filters.type.length > 0) {
        query = query.in("type", filters.type)
      }
      if (filters?.chat_id) {
        query = query.eq("chat_id", filters.chat_id)
      }
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data: tasks, error } = await query

      if (error) {
        throw error
      }

      set({ tasks: tasks || [], loading: false })

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

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", session.user.id)

      if (error) {
        throw error
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

      const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", session.user.id)

      if (error) {
        throw error
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

      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", session.user.id)
        .single()

      if (error) {
        throw error
      }

      return task
    } catch (error) {
      logger.error("Error fetching task", error as Error, { component: "task-store" })
      return null
    }
  },

  subscribeToTasks: () => {
    // Get current user session for filtering
    const getUserSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session
    }

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
        async (payload) => {
          const session = await getUserSession()
          if (!session) return

          // Only process changes for the current user's tasks
          const newRecord = payload.new as any
          const oldRecord = payload.old as any

          if (payload.eventType === "INSERT" && newRecord?.user_id === session.user.id) {
            // Add new task to local state
            set((state) => ({
              tasks: [newRecord, ...state.tasks],
            }))
          } else if (payload.eventType === "UPDATE" && newRecord?.user_id === session.user.id) {
            // Update existing task
            set((state) => ({
              tasks: state.tasks.map((task) => (task.id === newRecord.id ? newRecord : task)),
            }))
          } else if (payload.eventType === "DELETE" && oldRecord?.user_id === session.user.id) {
            // Remove deleted task
            set((state) => ({
              tasks: state.tasks.filter((task) => task.id !== oldRecord.id),
            }))
          }

          // Recalculate stats after any change
          get().fetchTaskStats()
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
