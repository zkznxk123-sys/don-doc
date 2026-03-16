import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  if (user.familyId) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
