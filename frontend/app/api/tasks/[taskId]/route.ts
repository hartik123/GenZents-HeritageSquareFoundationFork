import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
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
      .from("tasks")
      .select("*")
      .eq("id", params.taskId)
      .eq("user_id", user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { taskId: string } }) {
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
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Only allow updating certain fields for monitoring/metadata
    if (body.status !== undefined) updateData.status = body.status
    if (body.progress !== undefined) updateData.progress = body.progress
    if (body.result !== undefined) updateData.result = body.result
    if (body.error_message !== undefined) updateData.error_message = body.error_message
    if (body.logs !== undefined) updateData.logs = body.logs

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", params.taskId)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Task not found or update failed" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
