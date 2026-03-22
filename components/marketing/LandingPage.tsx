'use client'

import { motion } from 'framer-motion'
import { TrendingUp, FileSpreadsheet, Target, ArrowRight, Shield, Users, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut' as const, delay: i * 0.1 },
  }),
}

const FEATURES = [
  {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    title: '순자산 실시간 추적',
    desc: '자산·부채를 한 곳에 등록하고, 월별 순자산 변화를 차트로 한눈에 확인하세요. 부동산 LTV·ROI까지 자동 계산됩니다.',
  },
  {
    icon: FileSpreadsheet,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20',
    title: '엑셀 일괄 동기화',
    desc: '은행 앱에서 내보낸 엑셀 파일을 그대로 업로드하면, 거래 내역이 자동으로 분류·적재됩니다. 중복 걱정 없이.',
  },
  {
    icon: Target,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/20',
    title: '가족 예산 관리',
    desc: '카테고리별 월 예산을 설정하고 지출 현황을 실시간으로 모니터링하세요. 가족 구성원별 프라이버시도 설정 가능합니다.',
  },
]

const TRUST_BADGES = [
  { icon: Shield, label: '데이터 암호화 저장' },
  { icon: Users, label: '가족 단위 권한 관리' },
]

function DemoErrorBanner() {
  const params = useSearchParams()
  const err = params.get('demo_error')
  if (!err) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md bg-destructive/15 border border-destructive/30 text-sm text-destructive shadow-lg">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {err === 'not_seeded'
        ? '데모 데이터가 준비되지 않았습니다. 관리자에게 문의하세요.'
        : '데모 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.'}
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Suspense><DemoErrorBanner /></Suspense>

      {/* ── 네비게이션 ────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300">
        <span className="text-sm font-bold tracking-tight text-foreground font-serif">돈독</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="text-xs font-semibold bg-foreground text-background px-4 py-1.5 rounded-md hover:bg-foreground/90 transition-colors"
          >
            무료 시작
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden pt-16">

        {/* 배경 그라디언트 orb */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-primary/3 rounded-full blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 max-w-3xl mx-auto"
          initial="hidden"
          animate="visible"
        >
          {/* 뱃지 */}
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            패밀리 오피스 · 지금 무료로 시작하세요
          </motion.div>

          {/* 타이틀 */}
          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight font-serif"
          >
            우리 가족을 위한
            <br />
            <span className="text-foreground/60">
              프라이빗 뱅킹
            </span>
          </motion.h1>

          {/* 서브타이틀 */}
          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            자산·부채·예산·거래 내역을 한 곳에서. 가족 구성원별 권한 설정으로 내 정보는 내가 지킵니다.
          </motion.p>

          {/* CTA 버튼 */}
          <motion.div
            variants={fadeUp}
            custom={3}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="group flex items-center gap-2 px-6 py-3 rounded-md bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all active:scale-[0.97]"
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="/api/auth/demo"
              className="flex items-center gap-2 px-6 py-3 rounded-md border border-border bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-all active:scale-[0.97]"
            >
              데모 체험하기
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </motion.div>

          {/* 신뢰 배지 */}
          <motion.div
            variants={fadeUp}
            custom={4}
            className="mt-8 flex items-center justify-center gap-6"
          >
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* 스크롤 힌트 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        >
          <div className="w-px h-8 bg-gradient-to-b from-foreground/20 to-transparent" />
          <span className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">Scroll</span>
        </motion.div>
      </section>

      {/* ── Feature 섹션 ──────────────────────────────────────── */}
      <section className="py-24 px-6 bg-muted/40">
        <div className="max-w-5xl mx-auto">

          {/* 섹션 헤더 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-xs text-secondary uppercase tracking-widest mb-3 font-medium">
              핵심 기능
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight font-serif">
              복잡한 가족 재정,<br />
              <span className="text-muted-foreground">이제 한 화면에서</span>
            </motion.h2>
          </motion.div>

          {/* 기능 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  custom={i * 1.5}
                  className="group relative p-6 rounded-md bg-card hover:bg-muted/60 transition-all duration-300 shadow-[0_1px_3px_rgba(26,26,26,0.06),0_4px_16px_rgba(26,26,26,0.04)] dark:shadow-none dark:border dark:border-border"
                >
                  {/* 아이콘 */}
                  <div className={`w-10 h-10 rounded-md border flex items-center justify-center mb-5 ${feature.bg}`}>
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>

                  {/* 텍스트 */}
                  <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ─────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-serif">
            오늘부터 시작하세요
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground text-base mb-8 leading-relaxed">
            가입은 1분, 데이터는 평생 내 것. 광고 없이, 구독료 없이.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-8 py-3.5 rounded-md bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all active:scale-[0.97]"
            >
              무료로 시작하기 <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/api/auth/demo"
              className="flex items-center gap-2 px-8 py-3.5 rounded-md border border-border text-foreground text-sm font-medium hover:bg-muted transition-all active:scale-[0.97]"
            >
              먼저 둘러보기
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── 푸터 ─────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-6 text-center transition-colors duration-300">
        <p className="text-xs text-muted-foreground/50">
          © 2025 돈독 · 가족 재정관리 플랫폼
        </p>
      </footer>
    </div>
  )
}
