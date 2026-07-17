// Pure logic, no server-only dependency — safe to import from Client Components.
export function isPushEligible(
  plan: string | null | undefined,
  subscriptionStatus: string | null | undefined
): boolean {
  return (plan === 'pro' || plan === 'premium') && subscriptionStatus === 'active'
}
