// Task Management Types
// These types match the database schema and support the task queue workflow

export type TaskType = "organize" | "search" | "cleanup" | "folder_operation" | "backup" | "analysis"

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export interface Task {
  id: string
  user_id: string
  chat_id?: string
  type: TaskType
  command: string
  parameters: Record<string, any>
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
  max_retries: number
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

export interface CreateTaskRequest {
  type: TaskType
  command: string
  parameters?: Record<string, any>
  chat_id?: string
  priority?: number
  estimated_duration?: number
  max_retries?: number
}

export interface TaskUpdateRequest {
  status?: TaskStatus
  progress?: number
  result?: Record<string, any>
  error_message?: string
  logs?: string[]
  started_at?: string
  completed_at?: string
  estimated_duration?: number
}

export interface TaskFilterOptions {
  status?: TaskStatus[]
  type?: TaskType[]
  chat_id?: string
  created_after?: string
  created_before?: string
  priority_min?: number
  priority_max?: number
  limit?: number
  offset?: number
  sort_by?: "created_at" | "updated_at" | "priority" | "progress"
  sort_order?: "asc" | "desc"
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
  has_more: boolean
  stats: TaskStats
}

// Command processing types
export interface TaskCommandResult {
  isTask: boolean
  taskId?: string
  response?: string
  error?: string
}

export interface TaskCommandProcessor {
  processCommand(command: string, chatId?: string): Promise<TaskCommandResult>
  isLongRunningCommand(command: string): boolean
}

// Task processor types for backend
export interface TaskProcessorConfig {
  pollInterval: number
  maxConcurrentTasks: number
  retryDelays: number[]
  defaultTimeout: number
}

export interface TaskProcessor {
  start(): Promise<void>
  stop(): Promise<void>
  processTask(task: Task): Promise<void>
  updateTaskStatus(taskId: string, update: TaskUpdateRequest): Promise<void>
}

// Real-time subscription types
export interface TaskSubscriptionPayload {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  new?: Task
  old?: Task
}

export interface TaskSubscriptionCallback {
  (payload: TaskSubscriptionPayload): void
}

// Task management store types
export interface TaskStore {
  tasks: Task[]
  taskStats: TaskStats
  loading: boolean
  error: string | null

  // Actions
  fetchTasks: (filters?: TaskFilterOptions) => Promise<void>
  fetchTaskStats: () => Promise<void>
  cancelTask: (taskId: string) => Promise<boolean>
  deleteTask: (taskId: string) => Promise<boolean>
  getTask: (taskId: string) => Promise<Task | null>

  // Real-time updates
  subscribeToTasks: () => () => void
  refreshTask: (taskId: string) => Promise<void>
}

// UI Component types
export interface TaskCardProps {
  task: Task
  onCancel?: (taskId: string) => void
  onDelete?: (taskId: string) => void
  onRefresh?: (taskId: string) => void
  showDetails?: boolean
  compact?: boolean
}

export interface TaskManagerProps {
  filters?: TaskFilterOptions
  showStats?: boolean
  showFilters?: boolean
  allowCancel?: boolean
  allowDelete?: boolean
  className?: string
}

export interface TaskStatsCardProps {
  stats: TaskStats
  loading?: boolean
  onStatusClick?: (status: TaskStatus) => void
  className?: string
}

// Error types specific to tasks
export interface TaskError extends Error {
  taskId?: string
  taskType?: TaskType
  isRetryable?: boolean
  retryAfter?: number
}

export class TaskProcessingError extends Error implements TaskError {
  constructor(
    message: string,
    public taskId?: string,
    public taskType?: TaskType,
    public isRetryable: boolean = true,
    public retryAfter?: number
  ) {
    super(message)
    this.name = "TaskProcessingError"
  }
}

export class TaskValidationError extends Error implements TaskError {
  constructor(
    message: string,
    public taskId?: string,
    public taskType?: TaskType,
    public isRetryable: boolean = false
  ) {
    super(message)
    this.name = "TaskValidationError"
  }
}

// Utility types for task operations
export type TaskOperationResult<T = any> = {
  success: boolean
  data?: T
  error?: string
  taskId?: string
}

export type TaskBatchOperation = {
  taskIds: string[]
  operation: "cancel" | "delete" | "retry"
}

export type TaskBatchResult = {
  successful: string[]
  failed: Array<{ taskId: string; error: string }>
}
