export interface Command {
  name: string
  description: string
  pattern: RegExp
  category: CommandCategory
  enabled: boolean
  execute: (args: CommandArgs) => Promise<CommandResult>
}

export type CommandCategory = "file" | "organize" | "search" | "ai" | "system"

export interface CommandArgs {
  input: string
  args: string[]
  rawCommand: string
  context?: any
}

export interface CommandResult {
  success: boolean
  message: string
  data?: any
  suggestions?: string[]
}

export interface ToolsConfig {
  enabledCommands: string[]
  customCommands: Command[]
  commandPrefix: string
  autoSuggestions: boolean
  showCommandHelp: boolean
}

export const DEFAULT_COMMANDS: Command[] = [
  {
    name: "organize",
    description: "Organize files and folders in the current directory",
    pattern: /^\/organize(?:\s+(.+))?$/,
    category: "organize",
    enabled: true,
    execute: async ({ args }) => ({
      success: true,
      message: `Organizing files${args[0] ? ` in ${args[0]}` : ""}...`,
      suggestions: ["Files organized by type", "Duplicate files removed", "Empty folders cleaned"]
    })
  },
  {
    name: "folder",
    description: "Create or navigate to a specific folder",
    pattern: /^\/folder:(\S+)(?:\s+(.+))?$/,
    category: "file",
    enabled: true,
    execute: async ({ args }) => ({
      success: true,
      message: `${args[1] ? 'Creating' : 'Navigating to'} folder: ${args[0]}`,
      data: { folderName: args[0], action: args[1] || 'navigate' }
    })
  },
  {
    name: "search",
    description: "Search for files, folders, or content",
    pattern: /^\/search(?:\s+(.+))?$/,
    category: "search",
    enabled: true,
    execute: async ({ args }) => ({
      success: true,
      message: `Searching for: ${args[0] || 'all files'}`,
      data: { query: args[0] }
    })
  },
  {
    name: "cleanup",
    description: "Clean up temporary files and optimize storage",
    pattern: /^\/cleanup$/,
    category: "system",
    enabled: true,
    execute: async () => ({
      success: true,
      message: "Cleaning up temporary files and optimizing storage...",
      suggestions: ["Temporary files removed", "Cache cleared", "Storage optimized"]
    })
  },
  {
    name: "help",
    description: "Show available commands",
    pattern: /^\/help$/,
    category: "system",
    enabled: true,
    execute: async () => ({
      success: true,
      message: "Available commands:",
      suggestions: [
        "/organize - Organize files and folders",
        "/folder:name - Create or navigate to folder",
        "/search query - Search files and content",
        "/cleanup - Clean temporary files",
        "/help - Show this help"
      ]
    })
  }
]
