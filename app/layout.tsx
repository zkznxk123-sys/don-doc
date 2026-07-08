import type { Metadata } from "next"
import { Noto_Serif, Space_Grotesk } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/ThemeProvider"
import { ClerkThemeProvider } from "@/components/ClerkThemeProvider"
import { PostHogProvider } from "@/components/PostHogProvider"
import { PostHogPageView } from "@/components/PostHogPageView"
import { Suspense } from "react"
import { isLite } from "@/lib/feature-flags"
import "./globals.css"

// Serif used for numeric-display (large hero amounts) and editorial headlines
const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  weight: ["400", "700"],
  display: "swap",
})

// 영문 헤드/워드마크(BRAND_GUIDE §8) — don Doc 워드마크·영문 헤드라인
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  weight: ["300", "400", "500", "700"],
  display: "swap",
})

// 배포단위 env(NEXT_PUBLIC_PRODUCT_LINE) 분기 — 검색결과·링크카드 첫 노출면 (designer 2026-06-15 A-2)
const description = isLite()
  ? "가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에. 엑셀 한 번 업로드로 AI가 분류까지 끝내는 자산 통합 관리."
  : "가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에. 현금·금융·부동산·연금·부채를 통합 운영하는 자산 관리 시스템. 혼자든 가족이든 — 공유는 필요할 때만 선별적으로."

export const metadata: Metadata = {
  title: "돈Doc — 가장 쉬운 자산 관리",
  description,
  openGraph: {
    title: "돈Doc",
    description: "가장 쉬운 자산 관리 — 흩어진 자산을 한 화면에.",
    // images: ["/og-image.png"],  // 별도 제작 필요
    // ↑ 1200×630 OG 링크카드 미제작. 첫 스레드에 링크 붙이기 전 제작 필요 (프로필 아바타와 별개 자산)
    locale: "ko_KR",
    type: "website",
  },
  icons: {
    icon: "/brand-mark.svg",
    apple: "/brand-mark.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSerif.variable} ${spaceGrotesk.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <ClerkThemeProvider>
            <PostHogProvider>
              <Suspense>
                <PostHogPageView />
              </Suspense>
              {children}
              <Toaster theme="system" position="top-center" richColors closeButton />
            </PostHogProvider>
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
