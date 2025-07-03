import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { chatId: string } }) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the chat
    const { data: chatData } = await supabase
      .from("chats")
      .select("id")
      .eq("id", params.chatId)
      .eq("user_id", user.id)
      .single()

    if (!chatData) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0)

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", params.chatId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      messages: data,
      pagination: {
        limit,
        offset,
        total: data.length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
