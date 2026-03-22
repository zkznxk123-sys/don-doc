import { redirect } from 'next/navigation'

// /login → /sign-in 으로 영구 리다이렉트 (Clerk 사용)
export default function LoginPage() {
  redirect('/sign-in')
}
