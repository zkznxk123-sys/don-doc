import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { LandingPage } from '@/components/marketing/LandingPage'

export default async function Home() {
  const user = await getAuthUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
