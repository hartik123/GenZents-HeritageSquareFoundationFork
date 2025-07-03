import { createSupabaseServerClient } from "@/lib/supabase/server"
import { logger } from "@/lib/utils/logger"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { message, chatId } = await request.json()

    // Debug: Log the request
    logger.info("Chat API request received", {
      component: "chat-api",
      chatId,
      hasMessage: !!message,
    })

    // Try to get user from authorization header first
    const authHeader = request.headers.get("authorization")
    let user = null
    let token = null

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7)
      // Verify the token with Supabase
      const { data: userData, error: tokenError } = await supabase.auth.getUser(token)
      if (!tokenError && userData.user) {
        user = userData.user
      }
    }

    // Fallback to server-side session
    if (!user) {
      const {
        data: { user: sessionUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (!authError && sessionUser) {
        user = sessionUser
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession()
        token = sessionData.session?.access_token
      }
    }

    // Debug: Log auth status
    logger.info("Auth check result", {
      component: "chat-api",
      hasUser: !!user,
      userId: user?.id,
      hasToken: !!token,
      authMethod: authHeader ? "bearer" : "session",
    })

    if (!user || !token) {
      logger.error("Authentication failed", new Error("No user or token"), { component: "chat-api" })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000"

    logger.info("Proxying to backend", {
      component: "chat-api",
      backendUrl,
      endpoint: `${backendUrl}/api/messages/chat/${chatId}`,
      userId: user.id,
    })

    const res = await fetch(`${backendUrl}/api/messages/chat/${chatId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: "user",
        content: message,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { detail: errorText }
      }
      return NextResponse.json(
        {
          error: errorData.detail || "Failed to process message",
        },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error("Chat API error", error as Error, { component: "chat-api" })
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
