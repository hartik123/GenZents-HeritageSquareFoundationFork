import { getSupabaseAdmin } from '@/lib/supabase/server'

const supabase = getSupabaseAdmin()

export async function POST(req: Request) {
  const { token } = await req.json()
console.log("Verifying")
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 })
  }

  // 1. Lookup user by token
  const { data: user, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('invitation_token', token)
    .single()

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 400 })
  }

  // 2. Update user status to active
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', user.id)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
