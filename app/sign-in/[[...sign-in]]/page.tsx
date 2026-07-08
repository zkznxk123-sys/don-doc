import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { Wordmark } from '@/components/ui/wordmark'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 상단 브랜드 */}
      <div className="flex items-center px-8 h-16 border-b border-border/40">
        <Link href="/" className="hover:opacity-70 transition-opacity"><Wordmark size={20} /></Link>
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* 헤딩 */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              다시 오셨군요
            </h1>
            <p className="text-sm text-muted-foreground">
              복잡한 투자, 단순하게 — 로그인하고 이어가세요
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
        <p className="text-xs text-muted-foreground/50">© 2025 돈독 · 가장 쉬운 자산 관리</p>
      </div>
    </div>
  )
}
