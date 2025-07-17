"use client"

import * as React from "react"
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreHorizontal,
  Edit,
  Trash2,
  Share,
  Bookmark,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { MessageBubbleProps } from "@/lib/types/ui"
import { renderMarkdown } from "@/lib/utils/markdown"
import { useChatStore } from "@/lib/stores/chat-store"
import { useSettingsStore } from "@/lib/stores/settings-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { Message } from "@/lib/types"

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const { editMessage, deleteMessage, reactToMessage, getCurrentChat, currentChatId } = useChatStore()
  const settingsStore = useSettingsStore()
  const { toast } = useToast()
  const [isHovered, setIsHovered] = React.useState(false)

  const attachments = getCurrentChat()?.attachments || []
  const isUser = message.role === "user"
  const isSystem = message.role === "system"
  const { user, updateProfile } = useAuthStore()
  const [fullName, setFullName] = React.useState(user?.user_metadata?.full_name || "")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      toast({
        title: "Copied to clipboard",
        description: "Message content has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy message to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleReaction = (type: "liked" | "disliked") => {
    if (!currentChatId) return

    reactToMessage(message.id, type === "liked" ? "liked" : "disliked")
  }

  const handleRegenerate = async () => {
    if (!currentChatId) return
    try {
      await editMessage(message.id, message.content)
      toast({
        title: "Message regenerated",
        description: "The message has been regenerated.",
      })
    } catch (error) {
      toast({
        title: "Failed to regenerate",
        description: "Could not regenerate the message.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMessage(message.id)
      toast({
        title: "Message deleted",
        description: "The message has been deleted.",
      })
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: "Could not delete the message.",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = () => {
    const statusString = message.status?.status || "sent"
    switch (statusString) {
      case "sending":
        return <Clock className="h-3 w-3 text-muted-foreground animate-spin" />
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />
      default:
        return null
    }
  }

  const formatTimestamp = (date: Date) => {
    if (settingsStore.theme) {
      return format(date, "HH:mm")
    }
    return formatDistanceToNow(date, { addSuffix: true })
  }

  const getChatReactionComponent = (message: Message) => {
    if (isSystem || (!isHovered && !isLast)) return null;

    return (
      <>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
          <Copy className="h-3 w-3" />
        </Button>

        {!isUser && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction("liked")}
              className={cn(
                "h-8 w-8 p-0",
                message.reactions?.some((r) => r.type === "liked") && "text-green-500"
              )}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction("disliked")}
              className={cn(
                "h-8 w-8 p-0",
                message.reactions?.some((r) => r.type === "disliked") && "text-red-500"
              )}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>

            <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-8 w-8 p-0">
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isUser ? "end" : "start"}>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bookmark className="h-4 w-4 mr-2" />
              Bookmark
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  };

  return (
    <div
      className={cn(
        "group flex gap-3 message-enter",
        isUser ? "justify-end" : "justify-start",
        isSystem && "justify-center"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isSystem && !isUser && settingsStore.theme && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src="/favicon.ico" className="h-6 w-6 flex items-center justify-center" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}

      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "order-first")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm",
            isUser && "bg-primary text-primary-foreground ml-auto",
            !isUser && !isSystem && "bg-muted",
            isSystem && "bg-[hsl(var(--chat-system-bg))] text-[hsl(var(--chat-system-fg))] border text-center"
          )}
        >
          {!isUser && !isSystem ? (
            <div className="prose-chat" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}

          {attachments && attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {attachments.map((attachment: any) => (
                <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <div className="text-xs">
                    📎 {attachment.name} ({(attachment.size / 1024).toFixed(1)}KB)
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Reactions */}
          <div className={cn(
            "absolute right-0 top-0 flex items-center gap-1",
            "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0",
            "transition-all duration-300"
          )}>
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex gap-1 mt-2">
                {message.reactions.map((reaction, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {reaction.type === "liked" ? "👍" : "👎"}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground h-7")}>
          {settingsStore.theme && message.created_at && <span>{formatTimestamp(message.created_at)}</span>}

          {isUser && getStatusIcon()}

          {message.metadata && (
            <div className="flex items-center gap-1">
              {message.metadata.tokens && <span className="text-xs">{message.metadata.tokens} tokens</span>}
            </div>
          )}

          {/* Chat Reactions */}
          {getChatReactionComponent(message)}
        </div>

      </div>



      {isUser && settingsStore.theme && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src="/paceholder.svg?height=32&width=32" />
          <AvatarFallback>{fullName ? fullName.charAt(0).toUpperCase() : "U"}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
