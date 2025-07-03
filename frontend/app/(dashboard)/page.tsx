"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useChatStore } from "@/lib/stores/chat-store"
import { useStoreProvider } from "@/hooks/store-provider"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function HomePage() {
  const router = useRouter()
  const { user, loading, initialized } = useAuthStore()
  const { clearCurrentChat } = useChatStore()
  const storeProvider = useStoreProvider()

  useEffect(() => {
    if (initialized && !loading && storeProvider.isInitialized) {
      if (!user) {
        router.push("/auth")
      } else {
        clearCurrentChat()
      }
    }
  }, [user, loading, initialized, storeProvider.isInitialized, router, clearCurrentChat])

  if (!initialized || loading || !storeProvider.isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return <ChatInterface />
}
