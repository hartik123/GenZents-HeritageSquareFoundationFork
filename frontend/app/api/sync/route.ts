import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    // Forward the request to the backend sync endpoint
    const token = req.headers.get("authorization") || req.cookies.get("sb-access-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    const res = await fetch(`${backendUrl}/api/sync/drive`, {
      method: "POST",
      headers: {
        "Authorization": token,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(3000000) // 5 minutes timeout (300 seconds * 10 = 3000 seconds)
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
