import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ code?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const { code: inviteCode } = await searchParams

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 상단 브랜드 */}
      <div className="flex items-center px-8 h-16 border-b border-border/40">
        <Link href="/" className="text-sm font-bold tracking-tight text-foreground font-serif hover:opacity-70 transition-opacity">돈Doc</Link>
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* 헤딩 */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight font-serif text-foreground mb-2">
              무료로 시작하세요
            </h1>
            <p className="text-sm text-muted-foreground">
              가입은 1분 · 데이터는 평생 내 것
            </p>
          </div>

          {/* Clerk SignUp 컴포넌트 */}
          <SignUp
            routing="hash"
            fallbackRedirectUrl={inviteCode ? `/onboarding?code=${inviteCode}` : '/onboarding'}
            signInUrl="/sign-in"
            appearance={{
              layout: {
                logoPlacement: 'none',
                socialButtonsVariant: 'blockButton',
                socialButtonsPlacement: 'bottom',
              },
            }}
          />
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-8 py-6 text-center border-t border-border/40">
        <p className="text-xs text-muted-foreground/50">© 2025 돈Doc · 가족 재정관리 플랫폼</p>
      </div>
    </div>
  )
}
