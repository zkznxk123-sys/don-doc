import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.familyId) {
    redirect('/onboarding')
  }

  return <>{children}</>
}
