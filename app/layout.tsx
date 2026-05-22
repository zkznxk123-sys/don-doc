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
  title: "돈Doc — 흩어진 자산을 한 화면에",
  description: "흩어진 자산을 한 화면에. 시간은 최소로. 자산 관리를 책임진 한 사람이 통합 운영할 수 있는 자산 운영 시스템. 혼자 써도 충분, 필요하면 가족·동업자와 선별 공유.",
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
