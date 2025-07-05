import { create } from "zustand"
import { createClient } from "@/lib/supabase/client"
import { logger } from "@/lib/utils/logger"
import type { TaskStore } from "@/lib/types"

export const useTaskStore = create<TaskStore>((set, get) => ({
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

  fetchTasks: async (filters) => {
    try {
      set({ loading: true, error: null })
      const supabase = createClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error("No authentication session")

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

      if (error) throw error

      set({ tasks: tasks || [], loading: false })
      await get().fetchTaskStats()
    } catch (error) {
      logger.error("Error fetching tasks", error as Error, { component: "task-store" })
      set({ error: (error as Error).message, loading: false })
    }
  },

  fetchTaskStats: async () => {
    try {
      const tasks = get().tasks
      const stats = tasks.reduce(
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
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error("No authentication session")

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", session.user.id)

      if (error) throw error

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
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error("No authentication session")

      const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", session.user.id)

      if (error) throw error

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
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error("No authentication session")

      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", session.user.id)
        .single()

      if (error) throw error
      return task
    } catch (error) {
      logger.error("Error fetching task", error as Error, { component: "task-store" })
      return null
    }
  },

  subscribeToTasks: () => {
    const supabase = createClient()

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
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (!session) return

          const newRecord = payload.new as any
          const oldRecord = payload.old as any

          if (payload.eventType === "INSERT" && newRecord?.user_id === session.user.id) {
            set((state) => ({
              tasks: [newRecord, ...state.tasks],
            }))
          } else if (payload.eventType === "UPDATE" && newRecord?.user_id === session.user.id) {
            set((state) => ({
              tasks: state.tasks.map((task) => (task.id === newRecord.id ? newRecord : task)),
            }))
          } else if (payload.eventType === "DELETE" && oldRecord?.user_id === session.user.id) {
            set((state) => ({
              tasks: state.tasks.filter((task) => task.id !== oldRecord.id),
            }))
          }

          get().fetchTaskStats()
        }
      )
      .subscribe()

    set({ subscriptionCleanup: () => subscription.unsubscribe() })
    return () => subscription.unsubscribe()
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

  clearAll: () => {
    // Clean up subscription if it exists
    const state = get()
    if (state.subscriptionCleanup) {
      state.subscriptionCleanup()
    }

    set({
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
      subscriptionCleanup: undefined,
    })
  },
}))
