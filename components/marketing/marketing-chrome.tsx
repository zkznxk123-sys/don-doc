'use client'

/**
 * 마케팅 서브페이지(/product·/about) 공용 크롬 — Solid Modern 다크.
 * 랜딩 히어로(VideoHeroLight)와 같은 팔레트·톤으로 정합(BRAND_GUIDE §6·§14).
 * Nav·Footer·Reveal(스크롤 진입 페이드)·SectionShell(섹션 공통 헤더).
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRightCircle } from 'lucide-react'
import { Wordmark } from '@/components/ui/wordmark'
import {
  SM_SURFACE, SM_RAISED, SM_INK, SM_INK_DIM, SM_HAIRLINE, GOLD,
} from './landing/tokens'

const NAV_LINKS = [
  { href: '/product', label: '제품' },
  { href: '/about', label: '소개' },
  { href: '/demo', label: '데모' },
] as const

/** 다크 상단 네비 — 현재 페이지는 골드로 강조. */
export function MarketingNav({ active }: { active?: '/product' | '/about' }) {
  return (
    <nav className="relative z-10 max-w-[1280px] mx-auto flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5">
      <div className="flex items-center gap-7">
        <Link href="/" aria-label="돈독 홈"><Wordmark size={25} ink={SM_INK} dim={SM_INK_DIM} gold={GOLD} /></Link>
        <div className="hidden sm:flex items-center gap-5">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className="text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: active === l.href ? GOLD : SM_INK_DIM }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link href="/sign-in" className="inline-flex items-center px-2.5 sm:px-4 py-2.5 text-sm font-medium" style={{ color: SM_INK_DIM }}>로그인</Link>
        <Link href="/sign-up" className="rounded-full px-4 sm:px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
          style={{ background: GOLD, color: SM_SURFACE }}>무료 시작</Link>
      </div>
    </nav>
  )
}

/** 스크롤 진입 페이드업 — reduced-motion은 LandingPage MotionConfig가 아니라 여기선 whileInView. */
export function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** 섹션 공통 헤더 — kicker(골드) + H2(sans black, 강조어 골드 언더라인). */
export function SectionHead({ kicker, title, body, center }: {
  kicker: string; title: React.ReactNode; body?: string; center?: boolean
}) {
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      <p className="text-[11px] tracking-[0.18em] uppercase font-semibold mb-4" style={{ color: GOLD }}>{kicker}</p>
      <h2 className="font-black leading-[1.08] tracking-[-0.03em] text-[32px] sm:text-[40px] lg:text-[46px]"
        style={{ fontFamily: 'var(--font-sans)', color: SM_INK }}>{title}</h2>
      {body && <p className="text-base leading-[1.7] mt-6" style={{ color: SM_INK_DIM }}>{body}</p>}
    </div>
  )
}

/** 강조어 — 골드 + 언더라인. H1·H2 안에서 사용. */
export function Gold({ children, underline = true }: { children: React.ReactNode; underline?: boolean }) {
  return (
    <span style={{ color: GOLD, borderBottom: underline ? `3px solid ${GOLD}` : undefined, paddingBottom: underline ? 2 : undefined }}>
      {children}
    </span>
  )
}

/** 골드 CTA pill. */
export function GoldCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex items-center justify-between font-semibold transition-transform hover:scale-[1.04]"
      style={{ background: GOLD, color: SM_SURFACE, borderRadius: 50, padding: '15px 22px', minWidth: 200, gap: 24, boxShadow: '0 6px 28px rgba(201,165,74,0.32)' }}>
      {children} <ArrowRightCircle className="w-5 h-5" />
    </Link>
  )
}

/** 고스트 보조 CTA. */
export function GhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex items-center font-semibold transition-opacity hover:opacity-80"
      style={{ color: SM_INK, border: `1px solid ${SM_HAIRLINE}`, borderRadius: 50, padding: '15px 22px' }}>
      {children}
    </Link>
  )
}

/** 마감 CTA 블록 — 두 페이지 공통. */
export function ClosingCta({ title }: { title: React.ReactNode }) {
  return (
    <section className="px-6 md:px-14 py-24 md:py-32" style={{ background: SM_RAISED, borderTop: `1px solid ${SM_HAIRLINE}` }}>
      <div className="max-w-3xl mx-auto text-center">
        <Reveal>
          <h2 className="font-black leading-[1.08] tracking-[-0.03em] text-[34px] sm:text-[46px] mb-9"
            style={{ fontFamily: 'var(--font-sans)', color: SM_INK }}>{title}</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <GoldCta href="/sign-up">무료로 시작하기</GoldCta>
            <GhostCta href="/demo">데모 체험하기</GhostCta>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** 다크 푸터 — 링크 + 카피라이트. */
export function MarketingFooter() {
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    { title: '제품', links: [{ href: '/product', label: '기능·사용법' }, { href: '/demo', label: '데모 체험' }, { href: '/sign-up', label: '무료 시작' }] },
    { title: '회사', links: [{ href: '/about', label: '소개' }, { href: '/sign-in', label: '로그인' }] },
  ]
  return (
    <footer className="px-6 md:px-14 py-14" style={{ background: SM_SURFACE, borderTop: `1px solid ${SM_HAIRLINE}` }}>
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row justify-between gap-10">
        <div className="max-w-xs">
          <Wordmark size={24} ink={SM_INK} dim={SM_INK_DIM} gold={GOLD} />
          <p className="text-sm leading-[1.6] mt-4" style={{ color: SM_INK_DIM }}>복잡한 투자, 단순하게.<br />흩어진 자산을 한 화면에.</p>
        </div>
        <div className="flex gap-14">
          {cols.map(c => (
            <div key={c.title}>
              <p className="text-[11px] tracking-[0.14em] uppercase font-semibold mb-4" style={{ color: GOLD }}>{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm transition-opacity hover:opacity-80" style={{ color: SM_INK_DIM }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto mt-12 pt-6" style={{ borderTop: `1px solid ${SM_HAIRLINE}` }}>
        <p className="text-xs" style={{ color: SM_INK_DIM }}>© 2026 돈독 · 사실 기록·정렬 도구입니다. 특정 종목·상품 추천이 아닙니다.</p>
      </div>
    </footer>
  )
}

/** 페이지 히어로(상단) — eyebrow·H1·서브·CTA. 두 페이지 공통 골격. */
export function PageHero({ eyebrow, title, sub, primary, secondary }: {
  eyebrow: string; title: React.ReactNode; sub: string
  primary?: { href: string; label: string }; secondary?: { href: string; label: string }
}) {
  return (
    <header className="px-6 md:px-14 pt-10 pb-16 md:pt-16 md:pb-24">
      <div className="max-w-[1280px] mx-auto">
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase font-semibold mb-6"
          style={{ color: GOLD }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />{eyebrow}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="font-black leading-[1.04] tracking-[-0.035em] text-[44px] sm:text-[62px] lg:text-[72px]"
          style={{ fontFamily: 'var(--font-sans)', color: SM_INK }}>{title}</motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.22 }}
          className="text-base lg:text-[17px] leading-[1.7] mt-8 max-w-[540px]" style={{ color: SM_INK_DIM }}>{sub}</motion.p>
        {(primary || secondary) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.34 }}
            className="flex flex-wrap items-center gap-3 mt-10">
            {primary && <GoldCta href={primary.href}>{primary.label}</GoldCta>}
            {secondary && <GhostCta href={secondary.href}>{secondary.label}</GhostCta>}
          </motion.div>
        )}
      </div>
    </header>
  )
}
