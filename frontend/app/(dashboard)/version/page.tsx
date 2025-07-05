"use client"

import { VersionHistory } from "@/components/version"
import { useChatStore } from "@/lib/stores/chat-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function VersionHistoryPage() {
  const { getCurrentChat } = useChatStore()
  const currentChat = getCurrentChat()

  if (!currentChat) {
    return (
      <div className="h-full overflow-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Version History</h1>
            <p className="text-muted-foreground">View and manage your chat version history.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                No Chat Selected
              </CardTitle>
              <CardDescription>Please select or start a chat to view its version history.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Version history is tracked per chat session. Start a new conversation or select an existing chat to see
                its version history.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Version History</h1>
          <p className="text-muted-foreground">View and manage version history for &ldquo;{currentChat.title}&rdquo;</p>
        </div>
        <VersionHistory chatId={currentChat.id} />
      </div>
    </div>
  )
}
