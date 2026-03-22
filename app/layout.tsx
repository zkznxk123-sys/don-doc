import type { Metadata } from "next"
import { Inter, Noto_Serif } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/ThemeProvider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "돈독 — 디지털 패밀리오피스",
  description: "돈 관리는 똑똑하게, 관계는 더 돈독하게. 가족 간의 사생활은 존중하면서 자산은 투명하게 통합 관리하는 선별적 공유 기반 디지털 패밀리오피스.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSerif.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          {children}
          <Toaster theme="system" position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
