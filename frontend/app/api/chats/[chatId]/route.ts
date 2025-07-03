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

    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("id", params.chatId)
      .eq("user_id", user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { chatId: string } }) {
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
    const updateData: any = {}

    if (body.title !== undefined) updateData.title = body.title
    if (body.archived !== undefined) updateData.archived = body.archived
    if (body.bookmarked !== undefined) updateData.bookmarked = body.bookmarked
    if (body.model !== undefined) updateData.model = body.model
    if (body.system_prompt !== undefined) updateData.system_prompt = body.system_prompt
    if (body.tags !== undefined) updateData.tags = body.tags

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("chats")
      .update(updateData)
      .eq("id", params.chatId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Chat not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { chatId: string } }) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete all messages in the chat first
    await supabase.from("messages").delete().eq("chat_id", params.chatId)

    // Then delete the chat
    const { data, error } = await supabase
      .from("chats")
      .delete()
      .eq("id", params.chatId)
      .eq("user_id", user.id)
      .select()

    if (error || !data.length) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Chat deleted successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
