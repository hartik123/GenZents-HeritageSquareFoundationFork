import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const archived = searchParams.get("archived")
    const bookmarked = searchParams.get("bookmarked")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)

    let query = supabase
      .from("chats")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (archived !== null) {
      query = query.eq("archived", archived === "true")
    }
    if (bookmarked !== null) {
      query = query.eq("bookmarked", bookmarked === "true")
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ chats: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const { title, model, tags } = body

    const chatData = {
      title: title || "New Chat",
      user_id: user.id,
      model: model || "gemini-2.0-flash",
      tags: tags || [],
      bookmarked: false,
      archived: false,
      shared: false,
      version: 1,
    }

    const { data, error } = await supabase.from("chats").insert(chatData).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
