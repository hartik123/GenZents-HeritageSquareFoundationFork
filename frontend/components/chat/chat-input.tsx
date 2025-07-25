"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Send, Paperclip, Mic, MicOff, StopCircle, Hash, FileText, Folder, X, Upload, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useChatStore } from "@/lib/stores/chat-store"
import { logger } from "@/lib/utils/logger"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { sanitizeInput } from "@/lib/utils/security"
import { CommandSuggestions } from "./command-suggestions"
import { chatCommandProcessor } from "@/lib/services/command-processor"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_TYPES = [
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]

export function ChatInput() {
  const [input, setInput] = React.useState("")
  const [isRecording, setIsRecording] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({})
  const [showCommandSuggestions, setShowCommandSuggestions] = React.useState(false)
  const router = useRouter()

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { sendMessage, isStreaming, getCurrentChat, attachments, addAttachment, removeAttachment, selectChat } =
    useChatStore()
  const currentChat = getCurrentChat()
  const { toast } = useToast()

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = React.useCallback(async () => {
    if (!input.trim() && attachments.length === 0) return
    if (isStreaming) return

    const messageContent = sanitizeInput(input.trim())
    const wasNewChat = !currentChat

    setInput("")
    setShowCommandSuggestions(false)

    try {
      logger.info("Attempting to send message", {
        component: "chat-input",
        hasCurrentChat: !!currentChat,
        messageLength: messageContent.length,
      })

      const chatId = await sendMessage(messageContent, currentChat?.id)

      logger.info("Message sent successfully", { component: "chat-input", chatId, wasNewChat })

      // If this was a new chat, navigate to the newly created chat
      if (wasNewChat && chatId) {
        logger.info("Navigating to new chat", { component: "chat-input", chatId })
        selectChat(chatId)
        router.push(`/chat/${chatId}`)
      }
    } catch (error) {
      logger.error("Error sending message", error as Error, {
        component: "chat-input",
        messageContent: messageContent.substring(0, 50),
      })
      toast({
        title: "Error sending message",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      })
      // Restore the input on error
      setInput(messageContent)
    }
  }, [input, attachments, isStreaming, sendMessage, currentChat, selectChat, router, toast])

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === "Escape" && isStreaming) {
        sendMessage("", currentChat?.id || "")
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleSend, isStreaming, currentChat, sendMessage])

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB limit.`,
          variant: "destructive",
        })
        return
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({
          title: "File type not supported",
          description: `${file.name} file type is not supported.`,
          variant: "destructive",
        })
        return
      }
      const attachment: any = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      }
      // Simulate upload progress
      setUploadProgress((prev) => ({ ...prev, [attachment.id]: 0 }))
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          const current = prev[attachment.id] || 0
          if (current >= 100) {
            clearInterval(interval)
            addAttachment(attachment)
            setUploadProgress((prev) => {
              const { [attachment.id]: _, ...rest } = prev
              return rest
            })
            return prev
          }
          return { ...prev, [attachment.id]: current + 10 }
        })
      }, 100)
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const removeLocalAttachment = (id: string) => {
    removeAttachment(id)
  }

  const insertText = (before: string, after = "") => {
    if (!textareaRef.current) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const selectedText = input.substring(start, end)
    const newText = input.substring(0, start) + before + selectedText + after + input.substring(end)
    setInput(newText)
    // Set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + before.length + selectedText.length + after.length
        textareaRef.current.setSelectionRange(newPosition, newPosition)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleEnhancePrompt = () => {
    if (!input.trim()) {
      toast({
        title: "No prompt to enhance",
        description: "Please enter a prompt first.",
        variant: "destructive",
      })
      return
    }
    // Simple prompt enhancement logic
    let enhanced = input.trim()
    // Add context request if not present
    if (!enhanced.toLowerCase().includes("please") && !enhanced.toLowerCase().includes("can you")) {
      enhanced = `Please ${enhanced.charAt(0).toLowerCase() + enhanced.slice(1)}`
    }
    // Add specificity for short prompts
    if (enhanced.length < 50) {
      enhanced += ". Please provide detailed explanations and examples where helpful."
    }
    // Add structure request for longer prompts
    if (
      enhanced.length > 100 &&
      !enhanced.toLowerCase().includes("step") &&
      !enhanced.toLowerCase().includes("structure")
    ) {
      enhanced += " Please structure your response clearly with headings or bullet points."
    }
    // Add role specification if missing
    if (!enhanced.toLowerCase().includes("expert") && !enhanced.toLowerCase().includes("specialist")) {
      enhanced = `As an expert, ${enhanced.charAt(0).toLowerCase() + enhanced.slice(1)}`
    }
    setInput(enhanced)
    toast({
      title: "Prompt enhanced! ✨",
      description: "Your prompt has been improved for better AI responses.",
    })
  }

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      })
      return
    }
    if (isRecording) {
      setIsRecording(false)
      return
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onstart = () => {
      setIsRecording(true)
    }
    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput((prev) => prev + transcript)
    }
    recognition.onerror = (event: any) => {
      logger.error("Speech recognition error", undefined, { component: "chat-input", error: event.error })
      setIsRecording(false)
      toast({
        title: "Speech recognition error",
        description: "Failed to recognize speech. Please try again.",
        variant: "destructive",
      })
    }
    recognition.onend = () => {
      setIsRecording(false)
    }
    recognition.start()
  }

  const characterCount = input.length
  const maxCharacters = 4000

  // Show command suggestions when typing commands
  React.useEffect(() => {
    if (!textareaRef.current) {
      setShowCommandSuggestions(false)
      return
    }
    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)

    // Find the last occurrence of / before cursor position
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    if (lastSlashIndex === -1) {
      setShowCommandSuggestions(false)
      return
    }

    // Get text after the last slash
    const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1)

    // Show dropdown if we have a slash and no spaces after it (valid command pattern)
    const shouldShow = !textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")

    setShowCommandSuggestions(shouldShow)
  }, [input])

  // Also check when cursor position changes
  const handleCursorChange = React.useCallback(() => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)

    // Find the last occurrence of / before cursor position
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")

    if (lastSlashIndex === -1) {
      setShowCommandSuggestions(false)
      return
    }

    // Get text after the last slash
    const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1)

    // Show dropdown if we have a slash and no spaces after it
    const shouldShow = !textAfterSlash.includes(" ") && !textAfterSlash.includes("\n")
    setShowCommandSuggestions(shouldShow)
  }, [input])

  const handleCommandSelect = (command: string) => {
    if (command === "") {
      // Escape pressed - exit command mode
      setShowCommandSuggestions(false)
      return
    }
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart || 0
    const textBeforeCursor = input.substring(0, cursorPosition)
    const textAfterCursor = input.substring(cursorPosition)
    // Find the last occurrence of / before cursor position
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/")
    if (lastSlashIndex !== -1) {
      // Replace from the slash position to cursor with the selected command
      const textBeforeSlash = textBeforeCursor.substring(0, lastSlashIndex)
      const newInput = textBeforeSlash + command + " " + textAfterCursor
      setInput(newInput)
      setShowCommandSuggestions(false)
      // Focus textarea and set cursor position after the command
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newPosition = textBeforeSlash.length + command.length + 1
          textareaRef.current.setSelectionRange(newPosition, newPosition)
        }
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When command suggestions are visible, let the CommandSuggestions component handle navigation
    if (showCommandSuggestions) {
      // Only prevent default Enter and Tab to avoid sending the message
      if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
        e.preventDefault()
        return
      }
      // Let all other keys pass through to CommandSuggestions component
      return
    }
    // Handle regular Enter for sending message (only when not showing commands)
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Command Suggestions Dropdown - Render outside main container */}
      <CommandSuggestions
        input={input}
        onCommandSelect={handleCommandSelect}
        textareaRef={textareaRef}
        visible={showCommandSuggestions}
      />
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Attachments */}
        {(attachments.length > 0 || Object.keys(uploadProgress).length > 0) && (
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <Badge key={attachment.id} variant="secondary" className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  <span className="text-xs">{attachment.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeLocalAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {Object.entries(uploadProgress).map(([id, progress]) => (
                <div key={id} className="flex items-center gap-2 bg-muted px-2 py-1 rounded">
                  <Upload className="h-3 w-3" />
                  <Progress value={progress} className="w-16 h-2" />
                  <span className="text-xs">{progress}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div
          className={cn("p-4 transition-colors", isDragOver && "bg-primary/5 border-primary")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-end gap-2">
            {/* File Upload Button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Prompt Enhancer Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnhancePrompt}
              disabled={!input.trim()}
              className="flex-shrink-0"
              title="Enhance your prompt for better AI responses"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            {/* Text Input */}
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSelect={handleCursorChange}
                onKeyUp={handleCursorChange}
                placeholder={isStreaming ? "AI is responding..." : "Type your message or use /commands..."}
                disabled={isStreaming}
                className="min-h-[44px] max-h-[200px] resize-none pr-20"
                onKeyDown={handleKeyDown}
              />
              {/* Character Count */}
              {characterCount > maxCharacters * 0.8 && (
                <div
                  className={cn(
                    "absolute bottom-2 right-2 text-xs",
                    characterCount > maxCharacters ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {characterCount}/{maxCharacters}
                </div>
              )}
            </div>
            {/* Voice Input */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoiceInput}
              className={cn("flex-shrink-0", isRecording && "text-red-500 animate-pulse")}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            {/* Send/Stop Button */}
            {isStreaming ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => sendMessage("", currentChat?.id || "")}
                className="flex-shrink-0"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim() && attachments.length === 0}
                size="sm"
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Drag and Drop Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Drop files here to attach</p>
              </div>
            </div>
          )}
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_FILE_TYPES.join(",")}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>
      </div>
    </>
  )
}
