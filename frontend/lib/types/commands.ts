export interface Command {
  id: string
  name: string
  description: string
  pattern: RegExp
  instruction: string
  enabled: boolean
  user_id?: string
  type: "system" | "admin" | "user"
}

export interface CommandConfig {
  enabledCommands: string[]
  commandPrefix: string
}

export const DEFAULT_COMMANDS: Command[] = [
  {
    id: "1",
    name: "organize",
    description: "Organize files and folders in the current directory",
    pattern: /^\/organize(?:\s+(.+))?$/,
    instruction: "organize",
    enabled: true,
    type: "system",
  },
  {
    id: "2",
    name: "folder",
    description: "Create or navigate to a specific folder",
    pattern: /^\/folder:(\S+)(?:\s+(.+))?$/,
    instruction: "folder",
    enabled: true,
    type: "system",
  },
  {
    id: "3",
    name: "search",
    description: "Search for files, folders, or content",
    pattern: /^\/search(?:\s+(.+))?$/,
    instruction: "search",
    enabled: true,
    type: "system",
  },
  {
    id: "4",
    name: "cleanup",
    description: "Clean up temporary files and optimize storage",
    pattern: /^\/cleanup$/,
    instruction: "cleanup",
    enabled: true,
    type: "system",
  },
  {
    id: "5",
    name: "help",
    description: "Show available commands",
    pattern: /^\/help$/,
    instruction: "help",
    enabled: true,
    type: "system",
  },
]
