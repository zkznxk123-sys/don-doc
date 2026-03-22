import { redirect } from 'next/navigation'

// /signup → /sign-up 으로 영구 리다이렉트 (Clerk 사용)
export default function SignupPage() {
  redirect('/sign-up')
}
