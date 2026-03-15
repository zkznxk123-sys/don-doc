import { redirect } from 'next/navigation'

export default function Home() {
  // 미들웨어가 인증 상태를 체크하여 /login 또는 /dashboard로 리다이렉트
  redirect('/dashboard')
}
