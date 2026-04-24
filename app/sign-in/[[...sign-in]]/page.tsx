import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
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
              다시 오셨군요
            </h1>
            <p className="text-sm text-muted-foreground">
              가족 재정을 한 눈에 — 로그인하고 시작하세요
            </p>
          </div>

          {/* Clerk SignIn 컴포넌트 */}
          <SignIn
            routing="hash"
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/sign-up"
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
