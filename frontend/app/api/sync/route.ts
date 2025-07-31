import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    // Forward the request to the backend sync endpoint
    const token = req.headers.get("authorization") || req.cookies.get("sb-access-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000/api/sync/drive"
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json"
      },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
