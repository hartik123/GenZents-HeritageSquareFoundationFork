import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { message, chatId } = await request.json()

    const authHeader = request.headers.get("authorization")
    let user = null
    let token = null

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7)

      const tokenClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        }
      )

      const { data: userData, error: tokenError } = await tokenClient.auth.getUser()

      if (!tokenError && userData.user) {
        user = userData.user
      }
    }

    if (!user) {
      const {
        data: { user: sessionUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (!authError && sessionUser) {
        user = sessionUser
        const { data: sessionData } = await supabase.auth.getSession()
        token = sessionData.session?.access_token
      }
    }

    if (!user || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminSupabase = createAdminClient()

    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("permissions, is_admin, status")
      .eq("id", user.id)
      .single()

    if (profileError && !profile) {
      const { data: adminProfile, error: adminError } = await adminSupabase
        .from("profiles")
        .select("permissions, is_admin, status")
        .eq("id", user.id)
        .single()

      if (adminProfile) {
        profile = adminProfile
        profileError = null
      }
    }

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "Profile not found. Please ensure your account is properly set up.",
        },
        { status: 404 }
      )
    }

    if (profile.status !== "active") {
      return NextResponse.json({ error: "Account not active" }, { status: 403 })
    }

    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000"

    const res = await fetch(`${backendUrl}/api/messages/chat/${chatId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Id": user.id,
        "X-User-Permissions": JSON.stringify(profile.permissions || []),
        "X-User-Is-Admin": profile.is_admin ? "true" : "false",
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
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}
