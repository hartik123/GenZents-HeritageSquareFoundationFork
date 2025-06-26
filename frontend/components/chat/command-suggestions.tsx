"use client"

import * as React from "react"
import { Command, Terminal, Search, Folder, Sparkles, HelpCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { commandProcessor } from "@/lib/services/command-processor"
import { cn } from "@/lib/utils"

interface CommandSuggestionsProps {
  input: string
  onCommandSelect: (command: string) => void
  className?: string
}

const COMMAND_ICONS = {
  organize: Sparkles,
  folder: Folder,
  search: Search,
  cleanup: Terminal,
  help: HelpCircle,
} as const

export function CommandSuggestions({ input, onCommandSelect, className }: CommandSuggestionsProps) {
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [availableCommands, setAvailableCommands] = React.useState(commandProcessor.getAvailableCommands())

  React.useEffect(() => {
    if (input.startsWith('/')) {
      const newSuggestions = commandProcessor.getSuggestions(input)
      setSuggestions(newSuggestions)
    } else {
      setSuggestions([])
    }
  }, [input])

  React.useEffect(() => {
    setAvailableCommands(commandProcessor.getAvailableCommands())
  }, [])

  if (!input.startsWith('/')) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Command className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Available Commands</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableCommands.map((command) => {
              const Icon = COMMAND_ICONS[command.name as keyof typeof COMMAND_ICONS] || Terminal
              return (
                <button
                  key={command.name}
                  onClick={() => onCommandSelect(`/${command.name}`)}
                  className="flex items-center gap-2 p-2 text-left rounded-md hover:bg-muted transition-colors"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">/{command.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {command.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {command.category}
                  </Badge>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium text-primary">Command Suggestions</span>
        </div>
        <div className="space-y-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => {
                const commandPart = suggestion.split(' - ')[0]
                onCommandSelect(commandPart)
              }}
              className="block w-full text-left p-2 text-xs rounded hover:bg-primary/10 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
