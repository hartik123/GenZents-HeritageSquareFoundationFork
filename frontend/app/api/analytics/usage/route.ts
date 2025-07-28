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

    // Get usage statistics with parallel queries
    const [{ count: totalChats }, { count: totalMessages }, { count: totalTasks }, { count: activeTasks }] =
      await Promise.all([
        supabase.from("chats").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("messages")
          .select("*, chats!inner(user_id)", { count: "exact", head: true })
          .eq("chats.user_id", user.id),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["pending", "running"]),
      ])

    return NextResponse.json({
      total_chats: totalChats || 0,
      total_messages: totalMessages || 0,
      total_tasks: totalTasks || 0,
      active_tasks: activeTasks || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}