import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get message and verify user has access to the chat
    const { data, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        chats!inner(user_id)
      `
      )
      .eq("id", params.messageId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user owns the chat
    if (data.chats.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Remove nested chats data
    const { chats, ...message } = data
    return NextResponse.json(message)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    // Verify user owns the message's chat
    const { data: messageData } = await supabase
      .from("messages")
      .select(
        `
        id,
        chats!inner(user_id)
      `
      )
      .eq("id", params.messageId)
      .single()

    if (!messageData || (messageData.chats as any).user_id !== user.id) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("messages")
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.messageId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { messageId: string } }) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user owns the message's chat
    const { data: messageData } = await supabase
      .from("messages")
      .select(
        `
        id,
        chats!inner(user_id)
      `
      )
      .eq("id", params.messageId)
      .single()

    if (!messageData || (messageData.chats as any).user_id !== user.id) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const { error } = await supabase.from("messages").delete().eq("id", params.messageId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Message deleted successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
