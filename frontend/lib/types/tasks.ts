export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface Task {
  id: string
  user_id?: string
  chat_id?: string
  command_id: string
  parameters?: Record<string, any>
  status: TaskStatus
  progress: number
  result?: Record<string, any>
  error_message?: string
  logs: string[]
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_duration?: number
  priority: number
  retry_count: number
  updated_at: string
}

export interface TaskStats {
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
  total: number
}

export interface TaskFilterOptions {
  status?: TaskStatus[]
  type?: string[]
  chat_id?: string
  limit?: number
  offset?: number
}

export interface TaskStore {
  tasks: Task[]
  taskStats: TaskStats
  loading: boolean
  error: string | null
  fetchTasks: (filters?: TaskFilterOptions) => Promise<void>
  fetchTaskStats: () => Promise<void>
  cancelTask: (taskId: string) => Promise<boolean>
  deleteTask: (taskId: string) => Promise<boolean>
  getTask: (taskId: string) => Promise<Task | null>
  subscribeToTasks: () => () => void
  refreshTask: (taskId: string) => Promise<void>
  clearAll: () => void
  subscriptionCleanup?: () => void
}
