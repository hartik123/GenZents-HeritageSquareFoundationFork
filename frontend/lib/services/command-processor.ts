import { Command, CommandArgs, CommandResult, DEFAULT_COMMANDS } from "@/lib/types/commands"
import { logger } from "@/lib/utils/logger"

export class CommandProcessor {
  private commands: Map<string, Command> = new Map()
  private enabledCommands: Set<string> = new Set()

  constructor() {
    this.initializeCommands()
  }

  private initializeCommands() {
    DEFAULT_COMMANDS.forEach((command) => {
      this.commands.set(command.name, command)
      if (command.enabled) {
        this.enabledCommands.add(command.name)
      }
    })
  }

  isCommand(input: string): boolean {
    return input.trim().startsWith("/")
  }

  // Frontend command processor now only handles suggestions and validation
  // Actual command execution is done by the backend
  getSuggestions(input: string): string[] {
    if (!input.startsWith("/")) return []

    const partial = input.toLowerCase()
    const suggestions: string[] = []

    for (const command of this.commands.values()) {
      if (!this.enabledCommands.has(command.name)) continue

      const commandName = `/${command.name}`
      if (commandName.startsWith(partial)) {
        suggestions.push(`${commandName} - ${command.description}`)
      }
    }

    return suggestions
  }

  getAvailableCommands(): Command[] {
    return Array.from(this.commands.values()).filter((cmd) => this.enabledCommands.has(cmd.name))
  }

  enableCommand(commandName: string): void {
    if (this.commands.has(commandName)) {
      this.enabledCommands.add(commandName)
    }
  }

  disableCommand(commandName: string): void {
    this.enabledCommands.delete(commandName)
  }

  updateCommandsConfig(enabledCommands: string[]): void {
    this.enabledCommands.clear()
    enabledCommands.forEach((name) => {
      if (this.commands.has(name)) {
        this.enabledCommands.add(name)
      }
    })
  }

  // Validate command syntax without executing
  validateCommand(input: string): { valid: boolean; message?: string } {
    const trimmedInput = input.trim()

    if (!this.isCommand(trimmedInput)) {
      return { valid: false, message: "Not a valid command" }
    }

    for (const [name, command] of this.commands) {
      if (!this.enabledCommands.has(name)) continue

      const match = trimmedInput.match(command.pattern)
      if (match) {
        return { valid: true }
      }
    }

    return {
      valid: false,
      message: `Unknown command: ${trimmedInput.split(" ")[0]}. Type /help for available commands.`,
    }
  }
}

export const commandProcessor = new CommandProcessor()
