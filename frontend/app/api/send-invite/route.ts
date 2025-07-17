import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

const supabase = getSupabaseAdmin();

export async function POST(req: Request) {
  const { email, full_name, permissions, is_admin } = await req.json();
  const invitation_token = uuidv4();

  console.log('Inviting:', email, full_name, permissions, is_admin);

  // Step 1: Enable user creation and profile insert when needed(storing in auth.user table)
  // const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  //   email,
  //   user_metadata: {
  //     status: 'pending_invitation',
  //     is_admin,
  //     full_name,
  //     permissions,
  //   },
  //   email_confirm: false,
  // });

  // if (userError || !userData?.user?.id) {
  //   return new Response(JSON.stringify({ error: userError?.message || 'User creation failed' }), {
  //     status: 500,
  //   });
  // }

  // Step 2: Store user data into profile table
  // const userId = userData.user.id;

  // const { error: insertError } = await supabase.from('profiles').insert([
  //   {
  //     id: userId,
  //     email,
  //     full_name,
  //     permissions,
  //     status: 'pending_invitation',
  //     is_admin,
  //     invitation_token,
  //   },
  // ]);

  // if (insertError) {
  //   return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  // }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const mailOptions = {
      from: `"Your App Team" <${process.env.GMAIL_ID}>`,
      to: email,
      subject: `You're invited to join!`,
      html: `
        <p>Hi ${full_name},</p>
        <p>You have been invited to join the platform. Click the button below to accept your invitation:</p>
        <p><a href="${appUrl}/invite?token=${invitation_token}" style="background:#0070f3;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Accept Invitation</a></p>
        <p>If the button doesn’t work, copy and paste this link into your browser:</p>
        <p>${appUrl}/invite?token=${invitation_token}</p>
        <p>Thanks,<br/>The Team</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Email error:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500 });
  }
}
