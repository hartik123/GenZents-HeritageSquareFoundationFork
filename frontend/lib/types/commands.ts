export interface Command {
  name: string
  description: string
  pattern: RegExp
  category: CommandCategory
  enabled: boolean
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
  },
  {
    name: "folder",
    description: "Create or navigate to a specific folder",
    pattern: /^\/folder:(\S+)(?:\s+(.+))?$/,
    category: "file",
    enabled: true,
  },
  {
    name: "search",
    description: "Search for files, folders, or content",
    pattern: /^\/search(?:\s+(.+))?$/,
    category: "search",
    enabled: true,
  },
  {
    name: "cleanup",
    description: "Clean up temporary files and optimize storage",
    pattern: /^\/cleanup$/,
    category: "system",
    enabled: true,
  },
  {
    name: "help",
    description: "Show available commands",
    pattern: /^\/help$/,
    category: "system",
    enabled: true,
  },
]
