import type { Metadata } from 'next'
import { MarketingNav, MarketingFooter } from '@/components/marketing/marketing-chrome'

export const metadata: Metadata = {
  title: '개인정보처리방침 · 돈독',
  description: '돈독 개인정보처리방침 — 수집 항목, 이용 목적, 보관, 처리 위탁, 이용자 권리.',
}

/**
 * 개인정보처리방침 — planner 7/12 P0(실가입자 존재 시 법적 의무).
 * 2026-07-13 확정본: CPO 성명·직책(§7) 사용자 확정, 시행일 2026-07-12. 실제 데이터 흐름(Clerk·Vercel·DB·OpenAI·PostHog) 기준으로 작성.
 */

const SECTIONS: { h: string; body: (string | string[])[] }[] = [
  {
    h: '1. 수집하는 개인정보와 수집 방법',
    body: [
      '돈독은 서비스 제공에 필요한 최소한의 정보만 수집합니다.',
      [
        '회원 가입 시(필수): 이메일 주소, 로그인 식별자 — 인증 서비스(Clerk)를 통해 수집',
        '회원 가입 시(선택): 이름·프로필 정보(소셜 로그인 제공 범위 내)',
        '서비스 이용 시(이용자가 직접 입력): 자산·계좌·거래 내역, 예산, 메모 등 자산 관리 기록',
        '자동 수집: 서비스 이용 기록(페이지 방문 등, 통계 목적), 접속 기기·브라우저 정보',
      ],
      '계좌 비밀번호·공동인증서 등 금융 자격증명은 수집·저장하지 않습니다. 돈독은 금융기관 계정에 접속하지 않으며, 이용자가 입력하거나 업로드한 정보만 처리합니다.',
    ],
  },
  {
    h: '2. 이용 목적',
    body: [
      [
        '회원 식별·인증, 서비스 제공(자산 통합 화면·현금흐름·예산 등)',
        'AI 자동 분류: 이용자가 업로드한 거래·자산 내역의 카테고리 분류',
        '서비스 품질 개선을 위한 비식별 통계 분석',
      ],
    ],
  },
  {
    h: '3. 보유·이용 기간과 파기',
    body: [
      '개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존 의무가 있는 경우 해당 기간 동안 보관 후 파기합니다.',
      '이용자는 서비스 내에서 입력한 자산·거래 데이터를 직접 삭제할 수 있습니다.',
    ],
  },
  {
    h: '4. 처리 위탁과 국외 이전',
    body: [
      '서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁하며, 이들 업체의 서버는 국외(주로 미국)에 있을 수 있습니다.',
      [
        'Clerk (회원 인증·계정 관리)',
        'Vercel (서비스 호스팅)',
        'Supabase (데이터베이스 보관)',
        'OpenAI (AI 자동 분류 — 이용자가 업로드한 거래·자산 텍스트가 분류 목적에 한해 전송되며, 학습에 사용되지 않는 API 방식 사용)',
        'PostHog (비식별 이용 통계)',
      ],
    ],
  },
  {
    h: '5. 이용자의 권리',
    body: [
      '이용자는 언제든지 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다. 서비스 내 설정 또는 아래 문의처로 요청하면 지체 없이 처리합니다.',
    ],
  },
  {
    h: '6. 안전성 확보 조치',
    body: [
      [
        '전송 구간 암호화(HTTPS) 및 접근 통제',
        '계좌번호 등 민감 표시값의 화면 마스킹',
        '금융 자격증명 미수집 원칙',
      ],
    ],
  },
  {
    h: '7. 개인정보 보호책임자',
    body: [
      '개인정보 처리에 관한 업무를 총괄하고 이용자의 불만 처리·피해 구제를 담당하는 책임자를 아래와 같이 지정합니다.',
      [
        '성명: 한상빈',
        '직책: 개인정보 보호책임자',
        '연락처: zkznxk123@gmail.com',
      ],
    ],
  },
  {
    h: '8. 문의처',
    body: [
      '개인정보 관련 문의: zkznxk123@gmail.com',
      '본 방침은 2026년 7월 12일부터 적용됩니다. 내용이 바뀌면 이 페이지에서 고지합니다.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#182A24', color: '#F4F1E9', fontFamily: 'var(--font-sans)' }}>
      <MarketingNav />
      <main className="px-6 md:px-14 pb-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-black text-[32px] sm:text-[40px] tracking-[-0.03em] mt-8 mb-3">개인정보처리방침</h1>
          <p className="text-sm mb-10" style={{ color: 'rgba(244,241,233,0.62)' }}>
            돈독은 이용자의 자산 기록을 다루는 서비스인 만큼, 최소 수집·직접 통제 원칙을 지킵니다.
          </p>
          <div className="space-y-8">
            {SECTIONS.map(sec => (
              <section key={sec.h}>
                <h2 className="font-bold text-[17px] mb-2.5">{sec.h}</h2>
                <div className="space-y-2 text-[14px] leading-[1.75]" style={{ color: 'rgba(244,241,233,0.78)' }}>
                  {sec.body.map((b, i) =>
                    Array.isArray(b) ? (
                      <ul key={i} className="list-disc pl-5 space-y-1">
                        {b.map(li => <li key={li}>{li}</li>)}
                      </ul>
                    ) : <p key={i}>{b}</p>,
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
