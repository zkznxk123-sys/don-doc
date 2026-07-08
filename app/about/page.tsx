import type { Metadata } from 'next'
import { AboutPage } from '@/components/marketing/AboutPage'

export const metadata: Metadata = {
  title: '소개 · 돈독 — 복잡한 투자, 단순하게',
  description: '투자는 종목 고르기가 아닙니다. 여유자금을 단단한 자산으로 꾸준히 옮기는 습관 — 돈독이 말하는 투자와 만든 이유.',
}

export default function About() {
  return <AboutPage />
}
