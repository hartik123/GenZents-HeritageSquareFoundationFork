import type { Task } from "@/lib/types/tasks"

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
      const { data: tasks, error } = await supabase.from("tasks").select("status").eq("user_id", session.user.id)
      if (error) {
        return `Status: ❌ Error - ${error.message}`
      }
      const stats = { running: 0, pending: 0, completed: 0, failed: 0, cancelled: 0 }
      for (const t of tasks || []) {
        if (typeof t.status === "string" && t.status in stats) {
          stats[t.status as keyof typeof stats]++
        }
      }
      return `
**System Status:**
- Active Tasks: ${stats.running}
- Pending Tasks: ${stats.pending}
- Completed: ${stats.completed}
- Failed: ${stats.failed}
- Cancelled: ${stats.cancelled}
- Connection: ✅ Connected
          `.trim()
    } catch (error) {
      return `Status: ❌ Error - ${(error as Error).message}`
    }
  }
}

export const chatCommandProcessor = ChatCommandProcessor.getInstance()
