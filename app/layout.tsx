import type { Metadata } from "next"
import { Noto_Serif } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/ThemeProvider"
import { ClerkThemeProvider } from "@/components/ClerkThemeProvider"
import { PostHogProvider } from "@/components/PostHogProvider"
import { PostHogPageView } from "@/components/PostHogPageView"
import { Suspense } from "react"
import "./globals.css"

// Serif used for numeric-display (large hero amounts) and editorial headlines
const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  weight: ["400", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "돈Doc — 디지털 패밀리오피스",
  description: "가족의 자산을 더 돈독하게 연결하다. 가족 간의 사생활은 존중하면서 자산은 투명하게 통합 관리하는 선별적 공유 기반 디지털 패밀리오피스.",
  openGraph: {
    title: "돈Doc",
    description: "가족의 자산을 더 돈독하게 연결하다",
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
