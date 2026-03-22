import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()

  if (!user) redirect('/sign-in')
  if (!user.familyId) redirect('/onboarding')

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}
