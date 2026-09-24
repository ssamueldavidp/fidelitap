import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Email ownership proof for the public web forms (card activation/recovery),
// using Supabase Auth's email OTP so we don't run our own code store. The
// resulting session is discarded — we only need to know the code was valid.
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}

export async function sendEmailCode(email: string): Promise<boolean> {
  const { error } = await anonClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  return !error
}

export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const { data, error } = await anonClient().auth.verifyOtp({ email, token: code, type: 'email' })
  return !error && !!data.user
}
