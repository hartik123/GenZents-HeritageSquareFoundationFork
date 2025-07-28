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
    name: "summarize",
    description: "Generate a summary for a specific folder",
    pattern: /^\/summarize (?:\s+(.+))?$/,
    instruction: "summarize",
    enabled: true,
    type: "system",
  },
  
]
