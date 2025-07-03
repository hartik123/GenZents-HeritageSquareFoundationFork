"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { DEFAULT_COMMANDS } from "@/lib/types"

interface CommandSuggestionsProps {
  input: string
  onCommandSelect: (command: string) => void
  className?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  visible: boolean
}

export function CommandSuggestions({
  input,
  onCommandSelect,
  className,
  textareaRef,
  visible,
}: CommandSuggestionsProps) {
  const [suggestions, setSuggestions] = React.useState<typeof DEFAULT_COMMANDS>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Get command suggestions based on input
  const getSuggestions = (input: string) => {
    const query = input.toLowerCase().trim()
    if (!query.startsWith("/")) return []
    const searchTerm = query.substring(1)
    if (!searchTerm) return DEFAULT_COMMANDS
    return DEFAULT_COMMANDS.filter((cmd) => cmd.instruction.toLowerCase().includes(searchTerm))
  }

  // Update suggestions based on input
  React.useEffect(() => {
    if (!visible || !textareaRef?.current) {
      setSuggestions([])
      setSelectedIndex(0)
      return
    }
    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)
    // Find the last occurrence of / before cursor position
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")
    if (lastSlashIndex !== -1) {
      // Get the command text (everything after the last slash)
      const commandText = "/" + textBeforeCursor.substring(lastSlashIndex + 1)
      const newSuggestions = getSuggestions(commandText)
      setSuggestions(newSuggestions)
    } else {
      setSuggestions([])
    }
    setSelectedIndex(0)
  }, [input, visible, textareaRef])

  // Calculate dropdown position based on cursor position
  React.useEffect(() => {
    if (!visible || !textareaRef?.current) return
    const textarea = textareaRef.current
    const rect = textarea.getBoundingClientRect()
    // Get cursor position
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)
    // Calculate approximate cursor position
    const lines = textBeforeCursor.split("\n")
    const currentLineIndex = lines.length - 1
    const currentLineText = lines[currentLineIndex]
    // Rough estimation of cursor position (this is approximate)
    const lineHeight = 24 // Approximate line height
    const charWidth = 8 // Approximate character width
    const cursorTop = rect.top + currentLineIndex * lineHeight
    const cursorLeft = rect.left + currentLineText.length * charWidth
    // Calculate actual dropdown height based on current suggestions
    // Each suggestion is approximately 60px (command + description + example + padding)
    const suggestionHeight = 60 // Each suggestion item
    const maxHeight = 240 // max-h-60 = 240px
    const calculatedHeight = suggestions.length * suggestionHeight
    const actualHeight = Math.min(calculatedHeight, maxHeight)
    // Position dropdown above the cursor
    const top = Math.max(10, cursorTop - actualHeight)
    const left = Math.max(10, Math.min(cursorLeft, window.innerWidth - 410))
    setPosition({ top, left })
  }, [visible, textareaRef, input, suggestions.length])

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
            const selectedCommand = suggestions[selectedIndex]
            onCommandSelect(selectedCommand.instruction)
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
    return null
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[25]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="space-y-0 h-60 min-w-[300px] max-w-[400px] overflow-y-auto">
        {suggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex
          return (
            <button
              key={index}
              onClick={() => {
                onCommandSelect(suggestion.instruction)
              }}
              className={cn(
                "flex items-center gap-3 w-full text-left p-2 rounded text-sm transition-colors",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{suggestion.instruction}</div>
                <div
                  className={cn(
                    "text-xs truncate",
                    isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {suggestion.description}
                </div>
                <div
                  className={cn(
                    "text-xs truncate font-mono",
                    isSelected ? "text-primary-foreground/60" : "text-muted-foreground/60"
                  )}
                >
                  {suggestion.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
