import { v4 as uuidv4 } from 'uuid'
import sgMail from '@sendgrid/mail'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const supabase = getSupabaseAdmin()
sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function POST(req: Request) {
  const { email, full_name, permissions, is_admin } = await req.json()
  const invitation_token = uuidv4()

  console.log('Inviting:', email, full_name, permissions, is_admin)

  // 1. Create Auth User
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    user_metadata: {
      status: 'pending_invitation',
      is_admin,
      full_name,
      permissions,
    },
    email_confirm: false,
  })

  if (userError || !userData?.user?.id) {
    return new Response(
      JSON.stringify({ error: userError?.message || 'User creation failed' }),
      { status: 500 }
    )
  }

  const userId = userData.user.id

  // 2. Insert into profile table
  const { error: insertError } = await supabase.from('profiles').insert([
    {
      id: userId, // FK to auth.users.id
      email,
      full_name,
      permissions,
      status: 'pending_invitation',
      is_admin,
      invitation_token,
    },
  ])

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
  }

  // 3. Send Email
  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/register?token=${invitation_token}`
try {
    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_SENDER_EMAIL!,
      subject: 'You’re invited to register!',
      html: `<p>Hello ${full_name},</p>
             <p>You have been invited to register. Click the link below:</p>
             <a href="${inviteLink}">${inviteLink}</a>`,
    })

    console.log("EMAIL SENT")
    return new Response(JSON.stringify({ message: 'Invitation sent' }), { status: 200 })
  } catch (sendErr: unknown) {
    let message = 'Unknown error'
    if (sendErr instanceof Error) message = sendErr.message
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
