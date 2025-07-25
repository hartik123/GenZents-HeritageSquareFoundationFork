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
    const status = searchParams.get("status")
    const taskType = searchParams.get("task_type")
    const page = Math.max(parseInt(searchParams.get("page") || "1"), 1)
    const perPage = Math.min(Math.max(parseInt(searchParams.get("per_page") || "20"), 1), 100)

    let countQuery = supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id)

    let dataQuery = supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false })

    // Apply filters
    if (status) {
      countQuery = countQuery.eq("status", status)
      dataQuery = dataQuery.eq("status", status)
    }
    if (taskType) {
      countQuery = countQuery.eq("type", taskType)
      dataQuery = dataQuery.eq("type", taskType)
    }

    // Apply pagination
    const offset = (page - 1) * perPage
    dataQuery = dataQuery.range(offset, offset + perPage - 1)

    const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      tasks: data || [],
      pagination: {
        total: count || 0,
        page,
        per_page: perPage,
        has_next: count ? count > page * perPage : false,
        has_prev: page > 1,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
