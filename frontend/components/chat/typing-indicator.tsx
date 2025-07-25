import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-lg p-3">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
