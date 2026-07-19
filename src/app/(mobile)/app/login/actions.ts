'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function sendOtpAction(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function verifyOtpAction(email: string, token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return { error: error.message };

  // Vincular auth.user → customers.auth_user_id si no está vinculado
  const userId = data.user?.id;
  if (userId) {
    await supabase
      .from('customers')
      .update({ auth_user_id: userId })
      .eq('email', email)
      .is('auth_user_id', null);
  }

  redirect('/app/cards');
}
