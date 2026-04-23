'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield, Users, ChevronRight, AlertCircle, Eye, Sparkles, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BrandMark } from '@/components/ui/brand-mark'

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
    icon: Eye,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    title: '선별적 투명성',
    subtitle: '내 것은 내가 지킨다',
    desc: '가족과 재정을 공유하면서도 보여주고 싶은 것만 공개할 수 있습니다. 금액만 노출하거나 완전히 비공개로 — 가족이라도 프라이버시는 있어야 합니다.',
  },
  {
    icon: Sparkles,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20',
    title: 'AI 자동 분류',
    subtitle: '가계부 정리, 이제 안 해도 됩니다',
    desc: '은행 앱 엑셀을 업로드하면 AI가 카테고리를 자동 분류합니다. 내 소비 패턴을 학습해 갈수록 더 정확해집니다.',
  },
  {
    icon: BarChart3,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/20',
    title: '자산 최적화',
    subtitle: 'LTV, DSR, 연금까지 한눈에',
    desc: '부동산 LTV와 레버리지 현황, 연금 예상 수령액까지. 흩어진 자산을 하나의 뷰에서 파악하고 리스크를 관리하세요.',
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

// ── 앱 UI 인라인 목업 컴포넌트들 ─────────────────────────────────

function NetWorthMockup() {
  const bars = [38, 52, 45, 60, 55, 68, 80]
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm w-full">
      <p className="text-[10px] text-muted-foreground/70 mb-0.5">이번 달 순자산</p>
      <p className="text-2xl font-bold tabular-nums">7.3억</p>
      <p className="text-[11px] text-income mt-0.5 font-medium">↑ +2,300만 전월 대비</p>
      <div className="mt-3 flex items-end gap-1 h-10">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-all ${i === bars.length - 1 ? 'bg-[var(--viz-emerald)]' : 'bg-muted-foreground/15'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {['1월', '2월', '3월', '4월', '5월', '6월', '7월'].map(m => (
          <span key={m} className="text-[9px] text-muted-foreground/40 flex-1 text-center">{m}</span>
        ))}
      </div>
    </div>
  )
}

function RealEstateMockup() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm w-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground/70">래미안 ○○아파트</p>
          <p className="text-lg font-bold">9.5억</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-income-soft text-income font-medium">+26.7%</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">LTV</span>
            <span className="font-semibold text-income">42%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-[42%] bg-[var(--viz-emerald)] rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: 'DSR', value: '28.4%', ok: true },
            { label: '수익', value: '+3.4억', ok: true },
            { label: '대출', value: '-6.3억', ok: false },
          ].map(item => (
            <div key={item.label} className="bg-muted/40 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[9px] text-muted-foreground/60">{item.label}</p>
              <p className={`text-[11px] font-semibold mt-0.5 ${item.ok ? 'text-income' : 'text-expense'}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TransactionMockup() {
  const txs = [
    { name: '스타벅스 강남점', cat: '카페', amt: '-6,500', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', ai: true },
    { name: 'GS25 편의점', cat: '식비', amt: '-12,300', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', ai: true },
    { name: '쿠팡 로켓배송', cat: '쇼핑', amt: '-43,200', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', ai: true },
    { name: '월급 입금', cat: '급여', amt: '+4,200,000', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', ai: false },
  ]
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-muted-foreground/70 font-medium">거래 내역</p>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">AI 분류 완료</span>
      </div>
      <div className="space-y-0.5">
        {txs.map((tx) => (
          <div key={tx.name} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-medium ${tx.color}`}>{tx.cat}</span>
              <span className="text-xs text-foreground truncate">{tx.name}</span>
            </div>
            <span className={`text-xs font-medium tabular-nums ml-2 shrink-0 ${tx.amt.startsWith('+') ? 'text-income' : 'text-foreground/70'}`}>
              {tx.amt}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Suspense><DemoErrorBanner /></Suspense>

      {/* ── 네비게이션 ────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark variant="symbol" size={28} />
          <span className="text-sm font-black tracking-tight text-foreground">돈Doc</span>
        </Link>
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
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            패밀리 오피스 · 지금 무료로 시작하세요
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight font-serif"
          >
            가족의 자산을 더
            <br />
            <span className="text-secondary">돈독</span>하게 연결하다
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            매달 가계부 정리하다 지치셨나요?<br className="hidden sm:block" />
            엑셀 업로드 한 번으로 AI가 분류하고, 부동산 LTV부터 연금까지 가족의 재정 전체를 한눈에.
          </motion.p>

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

      {/* ── Value Proposition ─────────────────────────────────── */}
      <section className="py-24 px-6 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-xs text-secondary uppercase tracking-widest mb-3 font-medium">
              왜 돈Doc인가
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight font-serif">
              단순한 가계부가 아닙니다
              <br />
              <span className="text-muted-foreground">가족 재정 전체를 다룹니다</span>
            </motion.h2>
          </motion.div>

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
                  <div className={`w-10 h-10 rounded-md border flex items-center justify-center mb-5 ${feature.bg}`}>
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mb-1 font-medium">{feature.subtitle}</p>
                  <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Feature Preview ───────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-xs text-secondary uppercase tracking-widest mb-3 font-medium">
              미리 보기
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold tracking-tight font-serif">
              이런 화면들로<br />
              <span className="text-muted-foreground">가족 재정을 관리합니다</span>
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { label: '순자산 트렌드', component: <NetWorthMockup /> },
              { label: '부동산 LTV 현황', component: <RealEstateMockup /> },
              { label: 'AI 거래 분류', component: <TransactionMockup /> },
            ] as const).map((item, i) => (
              <motion.div
                key={item.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                custom={i * 1.5}
                className="flex flex-col gap-3"
              >
                <p className="text-xs font-medium text-muted-foreground/60 text-center">{item.label}</p>
                {item.component}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ─────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-muted/40">
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
          © 2025 돈Doc · 가족 재정관리 플랫폼
        </p>
      </footer>
    </div>
  )
}
