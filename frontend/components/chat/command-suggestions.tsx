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
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  visible: boolean
}

const COMMAND_ICONS = {
  organize: Sparkles,
  folder: Folder,
  search: Search,
  cleanup: Terminal,
  help: HelpCircle,
} as const

export function CommandSuggestions({
  input,
  onCommandSelect,
  className,
  textareaRef,
  visible,
}: CommandSuggestionsProps) {
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [availableCommands, setAvailableCommands] = React.useState(commandProcessor.getAvailableCommands())
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Debug visibility
  React.useEffect(() => {
    console.log("CommandSuggestions visibility changed:", visible)
  }, [visible])

  // Update suggestions based on input
  React.useEffect(() => {
    if (!visible) {
      setSuggestions([])
      setSelectedIndex(0)
      return
    }

    if (!textareaRef?.current) {
      setSuggestions([])
      setSelectedIndex(0)
      return
    }

    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)
    const currentLine = textBeforeCursor.split("\n").pop() || ""

    if (currentLine.startsWith("/")) {
      const newSuggestions = commandProcessor.getSuggestions(currentLine)
      setSuggestions(newSuggestions)
      setSelectedIndex(0)
    } else {
      setSuggestions([])
      setSelectedIndex(0)
    }
  }, [input, visible, textareaRef])

  // Update available commands
  React.useEffect(() => {
    setAvailableCommands(commandProcessor.getAvailableCommands())
  }, [])

  // Calculate dropdown position based on textarea position
  React.useEffect(() => {
    if (!visible || !textareaRef?.current) return

    const textarea = textareaRef.current
    const rect = textarea.getBoundingClientRect()

    // Position dropdown above the textarea with some padding
    const dropdownHeight = 280 // Approximate height
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom

    let top: number
    if (spaceAbove >= dropdownHeight + 16) {
      // Show above textarea
      top = rect.top - dropdownHeight - 8
    } else if (spaceBelow >= dropdownHeight + 16) {
      // Show below textarea
      top = rect.bottom + 8
    } else {
      // Show above even if there's not enough space (user can scroll)
      top = Math.max(16, rect.top - dropdownHeight - 8)
    }

    // Center horizontally relative to textarea, but ensure it stays on screen
    const dropdownWidth = 400 // Approximate width
    let left = rect.left
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = window.innerWidth - dropdownWidth - 16
    }
    if (left < 16) {
      left = 16
    }

    setPosition({ top, left })
  }, [visible, textareaRef, input])

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!visible || suggestions.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the textarea is focused
      if (document.activeElement !== textareaRef?.current) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
          return
        case "ArrowUp":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          return
        case "Enter":
        case "Tab":
          e.preventDefault()
          e.stopPropagation()
          if (suggestions[selectedIndex]) {
            const commandPart = suggestions[selectedIndex].split(" - ")[0]
            onCommandSelect(commandPart)
          }
          return
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          onCommandSelect("") // Clear command mode
          return
        default:
          return
      }
    }

    // Add event listener to document to capture all key events
    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [visible, suggestions, selectedIndex, onCommandSelect, textareaRef])

  if (!visible || suggestions.length === 0) {
    // Temporary debug
    if (visible) {
      console.log("CommandSuggestions not showing - suggestions:", suggestions)
    }
    return null
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <Card
        className={cn(
          "border shadow-2xl bg-background/95 backdrop-blur min-w-[300px] max-w-[400px] border-border/50",
          className
        )}
      >
        <CardContent className="p-2">
          <div className="flex items-center gap-2 mb-2 px-2 py-1">
            <Command className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Commands</span>
          </div>
          <div className="space-y-0 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const commandName = suggestion.split(" - ")[0].substring(1) // Remove leading /
              const Icon = COMMAND_ICONS[commandName as keyof typeof COMMAND_ICONS] || Terminal
              const isSelected = index === selectedIndex

              return (
                <button
                  key={index}
                  onClick={() => {
                    const commandPart = suggestion.split(" - ")[0]
                    onCommandSelect(commandPart)
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full text-left p-2 rounded text-sm transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{suggestion.split(" - ")[0]}</div>
                    <div
                      className={cn(
                        "text-xs truncate",
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {suggestion.split(" - ")[1]}
                    </div>
                  </div>
                  <Badge variant={isSelected ? "secondary" : "outline"} className="text-xs flex-shrink-0">
                    {availableCommands.find((cmd) => cmd.name === commandName)?.category || "command"}
                  </Badge>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 px-2 py-1 text-xs text-muted-foreground border-t">
            <span>↑↓ navigate</span>
            <span>•</span>
            <span>Enter to select</span>
            <span>•</span>
            <span>Esc to close</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
