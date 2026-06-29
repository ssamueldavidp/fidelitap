import { RegisterForm } from './register-form'

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { plan?: string }
}) {
  const validPlans = ['free', 'basic', 'pro', 'premium']
  const plan = validPlans.includes(searchParams.plan ?? '') ? searchParams.plan! : 'free'

  return <RegisterForm initialPlan={plan} />
}
