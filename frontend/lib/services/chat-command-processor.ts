import type { TaskCommandResult, TaskType, CreateTaskRequest, Task } from "@/lib/types/tasks"

export class ChatCommandProcessor {
  private static instance: ChatCommandProcessor
  private apiBase: string

  private constructor() {
    this.apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  }

  static getInstance(): ChatCommandProcessor {
    if (!ChatCommandProcessor.instance) {
      ChatCommandProcessor.instance = new ChatCommandProcessor()
    }
    return ChatCommandProcessor.instance
  }

  async processCommand(command: string, chatId?: string): Promise<TaskCommandResult> {
    try {
      // Check if this should be a long-running task
      if (this.isLongRunningCommand(command)) {
        return await this.createTask(command, chatId)
      }

      // For non-task commands, return immediate response
      return {
        isTask: false,
        response: await this.processImmediateCommand(command),
      }
    } catch (error) {
      return {
        isTask: false,
        error: (error as Error).message,
      }
    }
  }

  private isLongRunningCommand(command: string): boolean {
    const longRunningKeywords = [
      "/organize",
      "/search",
      "/cleanup",
      "/backup",
      "analyze",
      "scan",
      "index",
      "process large",
      "batch",
      "bulk",
      "mass operation",
    ]

    const commandLower = command.toLowerCase()
    return longRunningKeywords.some((keyword) => commandLower.includes(keyword))
  }

  private async createTask(command: string, chatId?: string): Promise<TaskCommandResult> {
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error("No authentication session")
      }

      const response = await fetch(`${this.apiBase}/api/tasks/process-command`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command,
          chat_id: chatId,
          priority: 5,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`)
      }

      const task = await response.json()

      return {
        isTask: true,
        taskId: task.id,
        response: `Task created: ${command}. You can monitor its progress in the Tasks page.`,
      }
    } catch (error) {
      throw error
    }
  }

  private async processImmediateCommand(command: string): Promise<string> {
    // Handle immediate commands that don't require background processing
    const commandLower = command.toLowerCase()

    if (commandLower.startsWith("/help")) {
      return this.getHelpText()
    }

    if (commandLower.startsWith("/status")) {
      return await this.getSystemStatus()
    }

    // Default response for unrecognized commands
    return `Command "${command}" is not recognized. Type /help for available commands.`
  }

  private getHelpText(): string {
    return `
**Available Commands:**

**Long-running Tasks:**
- \`/organize [path]\` - Organize files in the specified directory
- \`/search [query]\` - Search for files and content
- \`/cleanup\` - Clean up temporary files and duplicates
- \`/backup\` - Create a backup of your files
- \`/folder:name create\` - Create a new organized folder

**Immediate Commands:**
- \`/help\` - Show this help message
- \`/status\` - Show current system status

**Examples:**
- \`/organize Downloads\` - Organize files in Downloads folder
- \`/search "important document"\` - Search for documents containing "important document"
- \`/cleanup\` - Start cleanup process
    `.trim()
  }

  private async getSystemStatus(): Promise<string> {
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        return "Status: Not authenticated"
      }

      // Get task statistics
      const response = await fetch(`${this.apiBase}/api/tasks/`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        const tasks = data.tasks || []

        const stats = tasks.reduce((acc: any, task: Task) => {
          acc[task.status] = (acc[task.status] || 0) + 1
          return acc
        }, {})

        return `
**System Status:**
- Active Tasks: ${stats.running || 0}
- Pending Tasks: ${stats.pending || 0}
- Completed Today: ${stats.completed || 0}
- Connection: ✅ Connected
        `.trim()
      }

      return "Status: ✅ Connected (Task data unavailable)"
    } catch (error) {
      return `Status: ❌ Error - ${(error as Error).message}`
    }
  }
}

export const chatCommandProcessor = ChatCommandProcessor.getInstance()
