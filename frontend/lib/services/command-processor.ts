import { Command, CommandArgs, CommandResult, DEFAULT_COMMANDS } from "@/lib/types/commands"
import { logger } from "@/lib/utils/logger"

export class CommandProcessor {
  private commands: Map<string, Command> = new Map()
  private enabledCommands: Set<string> = new Set()

  constructor() {
    this.initializeCommands()
  }

  private initializeCommands() {
    DEFAULT_COMMANDS.forEach(command => {
      this.commands.set(command.name, command)
      if (command.enabled) {
        this.enabledCommands.add(command.name)
      }
    })
  }

  isCommand(input: string): boolean {
    return input.trim().startsWith('/')
  }

  async processCommand(input: string): Promise<CommandResult> {
    const trimmedInput = input.trim()
    
    if (!this.isCommand(trimmedInput)) {
      return {
        success: false,
        message: "Not a valid command"
      }
    }

    try {
      for (const [name, command] of this.commands) {
        if (!this.enabledCommands.has(name)) continue

        const match = trimmedInput.match(command.pattern)
        if (match) {
          const args: CommandArgs = {
            input: trimmedInput,
            args: match.slice(1).filter(Boolean),
            rawCommand: match[0],
            context: {}
          }

          logger.info("Executing command", { 
            component: "command-processor", 
            command: name, 
            args: args.args 
          })

          return await command.execute(args)
        }
      }

      return {
        success: false,
        message: `Unknown command: ${trimmedInput.split(' ')[0]}`,
        suggestions: [
          "Type /help to see available commands",
          "Available: /organize, /folder:name, /search, /cleanup"
        ]
      }
    } catch (error) {
      logger.error("Command execution failed", error as Error, { 
        component: "command-processor", 
        input: trimmedInput 
      })

      return {
        success: false,
        message: "Command execution failed",
        suggestions: ["Please try again or contact support"]
      }
    }
  }

  getAvailableCommands(): Command[] {
    return Array.from(this.commands.values()).filter(cmd => 
      this.enabledCommands.has(cmd.name)
    )
  }

  getSuggestions(input: string): string[] {
    if (!input.startsWith('/')) return []

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
    enabledCommands.forEach(name => {
      if (this.commands.has(name)) {
        this.enabledCommands.add(name)
      }
    })
  }
}

export const commandProcessor = new CommandProcessor()
