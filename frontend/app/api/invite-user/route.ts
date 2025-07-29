// app/api/invite-user/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabaseAdmin = createAdminClient()

  try {
    const { email, fullName, permissions } = await request.json()

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        permissions: permissions,
        status: "pending_invitation",
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`,
    })

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err: any) {
    console.error("Invite error:", err)
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 })
  }
}
