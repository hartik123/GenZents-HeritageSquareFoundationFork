import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      return NextResponse.json({ error: "No session token" }, { status: 401 })
    }

    const body = await request.json()
    const { type, command, chat_id, priority, parameters, estimated_duration, max_retries } = body

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000"

    const response = await fetch(`${backendUrl}/api/tasks/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type,
        command,
        chat_id,
        priority: priority || 5,
        parameters: parameters || {},
        estimated_duration,
        max_retries: max_retries || 3,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
