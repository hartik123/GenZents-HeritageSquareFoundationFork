"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "./message-bubble"
import { TypingIndicator } from "./typing-indicator"
import { useChatStore } from "@/lib/stores/chat-store"

export function ChatMessages() {
  const { getCurrentChat, getCurrentMessages, isStreaming } = useChatStore()
  const currentChat = getCurrentChat()
  const currentMessages = getCurrentMessages()

  if (!currentChat) return null

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-4 max-w-4xl mx-auto">
        {currentMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && <TypingIndicator />}
      </div>
    </ScrollArea>
  )
}
