/**
 * account-drawer 상수 — 계좌 타입·공유 단계·부채 상환·연금 종류 등.
 * UI 본체에서 분리해 가독성 + 다른 컴포넌트(부동산·연금 등) 재사용 가능성 확보.
 */

import {
  Banknote, TrendingUp, PiggyBank, Bitcoin, Building2,
  HandCoins, CreditCard, Users, Eye, EyeOff,
} from 'lucide-react'
import type { AccountType, ShareLevel, RepaymentType, DebtType, PensionType } from '@/lib/actions/accounts'
import { assetColor } from '@/lib/asset-colors'

// color = 단일 소스(lib/asset-colors) hex. drawer 타입 선택기에서 인라인 style로 적용.
export const ACCOUNT_TYPES: {
  value: AccountType; label: string; desc: string; Icon: React.ElementType; color: string; isLiability?: boolean
}[] = [
  { value: 'CASH',        label: '현금 · 예적금', desc: '생활비, 비상금, 저축',         Icon: Banknote,   color: assetColor('CASH') },
  { value: 'INVESTMENT',  label: '주식 · 펀드',   desc: '국내외 주식, 펀드, ETF',       Icon: TrendingUp, color: assetColor('INVESTMENT') },
  { value: 'PENSION',     label: '연금',           desc: 'IRP, 연금저축, 퇴직연금 등',  Icon: PiggyBank,  color: assetColor('PENSION') },
  { value: 'CRYPTO',      label: '가상자산',       desc: '비트코인, 이더리움 등',        Icon: Bitcoin,    color: assetColor('CRYPTO') },
  { value: 'REAL_ESTATE', label: '부동산',         desc: '아파트, 토지, 상가',           Icon: Building2,  color: assetColor('REAL_ESTATE') },
  { value: 'DEBT',        label: '대출',           desc: '주택담보대출, 신용대출 등',    Icon: HandCoins,  color: assetColor('DEBT'),  isLiability: true },
  { value: 'CREDIT_CARD', label: '신용카드',       desc: '카드 사용액, 미결제 금액',     Icon: CreditCard, color: assetColor('CREDIT_CARD'),  isLiability: true },
]

export const SHARE_LEVELS: {
  value: ShareLevel; label: string; desc: string; icon: React.ElementType; color: string; bg: string
}[] = [
  { value: 'PUBLIC',       label: '내역까지 공개', desc: '이름·금액·거래 내역 모두 공개',         icon: Users,  color: 'text-income',            bg: 'bg-income-soft' },
  { value: 'BALANCE_ONLY', label: '금액만 합산',   desc: '금액은 가족 합계에 포함, 내역은 숨김', icon: Eye,    color: 'text-savings',           bg: 'bg-savings-soft' },
  { value: 'PRIVATE',      label: '나만 보기',     desc: '가족 리스트에서 완전히 제외됨',         icon: EyeOff, color: 'text-muted-foreground',  bg: 'bg-muted border-border' },
]

export const REPAYMENT_TYPES: { value: RepaymentType; label: string }[] = [
  { value: 'EQUAL_PRINCIPAL_INTEREST', label: '원리금균등' },
  { value: 'EQUAL_PRINCIPAL',          label: '원금균등' },
  { value: 'BULLET',                   label: '만기일시' },
  { value: 'INTEREST_ONLY',            label: '이자만납부' },
]

export const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: 'MORTGAGE',       label: '주택담보대출' },
  { value: 'JEONSE_DEPOSIT', label: '전세보증금(수취)' },
  { value: 'CREDIT_LOAN',    label: '신용대출' },
  { value: 'OVERDRAFT',      label: '마이너스통장' },
  { value: 'ETC',            label: '기타' },
]

export const DEBT_TYPES_NEEDING_ASSET: DebtType[] = ['MORTGAGE', 'JEONSE_DEPOSIT']

export const PROPERTY_TYPES = ['아파트', '빌라', '오피스텔', '단독주택', '상가', '토지', '기타']

export const FINANCIAL_TYPES: AccountType[] = ['CASH', 'INVESTMENT', 'CRYPTO', 'STO']

export const PENSION_TYPES_LIST: { value: PensionType; label: string; taxDeductible: boolean }[] = [
  { value: 'PUBLIC_PENSION',   label: '공적연금 (국민/공무원)',    taxDeductible: false },
  { value: 'RETIREMENT_DB',    label: '퇴직연금 DB형',            taxDeductible: false },
  { value: 'RETIREMENT_DC',    label: '퇴직연금 DC형',            taxDeductible: false },
  { value: 'IRP',              label: 'IRP (개인형 퇴직연금)',     taxDeductible: true  },
  { value: 'PERSONAL_PENSION', label: '개인연금 (연금저축/보험)',   taxDeductible: true  },
  { value: 'HOME_PENSION',     label: '주택연금',                  taxDeductible: false },
]
