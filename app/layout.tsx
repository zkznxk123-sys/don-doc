import type { Metadata } from "next"
import { Noto_Serif } from "next/font/google"
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

// 배포단위 env(NEXT_PUBLIC_PRODUCT_LINE) 분기 — 검색결과·링크카드 첫 노출면 (designer 2026-06-15 A-2)
const description = isLite()
  ? "흩어진 자산을 한 화면에. 시간은 최소로. 엑셀 한 번 업로드로 AI가 분류까지 끝내는 자산 통합 관리."
  : "흩어진 자산을 한 화면에. 시간은 최소로. 현금·금융·부동산·연금·부채를 통합 운영하는 자산 관리 시스템. 혼자든 가족이든 — 공유는 필요할 때만 선별적으로."

export const metadata: Metadata = {
  title: "돈Doc — 흩어진 자산을 한 화면에",
  description,
  openGraph: {
    title: "돈Doc",
    description: "흩어진 자산을 한 화면에. 시간은 최소로.",
    // images: ["/og-image.png"],  // 별도 제작 필요
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
      <body className={`${notoSerif.variable} font-sans`}>
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
