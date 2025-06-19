import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { message, chatId } = await request.json()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Save user message
    const { error: messageError } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: message,
    })

    if (messageError) {
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 })
    }

    // Here you would integrate with your AI service (OpenAI, Anthropic, etc.)
    // For now, we'll return a mock response
    const aiResponse = "This is a simulated AI response. In a real implementation, this would call your AI service."

    // Save AI response
    const { error: aiMessageError } = await supabase.from("messages").insert({
      chat_id: chatId,
      role: "assistant",
      content: aiResponse,
    })

    if (aiMessageError) {
      return NextResponse.json({ error: "Failed to save AI response" }, { status: 500 })
    }

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
