'use client'

/**
 * account-drawer 타입별 sub-form 섹션.
 * 메인 drawer가 상태를 들고 props로 내려준다 — 상태 캡슐화는 본체 useReducer 마이그레이션 시점에 별도.
 */

import { ChevronDown } from 'lucide-react'
import type { PensionType } from '@/lib/actions/accounts'
import { Label } from '@/components/ui/label'
import { PENSION_TYPES_LIST } from './constants'
import { SectionDivider, NumberField, RateField, DateField } from './fields'

// ─── 금융자산 (CASH / INVESTMENT / CRYPTO / STO) ───────────────────
export function FinancialSection({
  faInterestRate, setFaInterestRate,
  faMonthlyPayment, setFaMonthlyPayment,
  faMaturityDate, setFaMaturityDate,
}: {
  faInterestRate: string; setFaInterestRate: (v: string) => void
  faMonthlyPayment: string; setFaMonthlyPayment: (v: string) => void
  faMaturityDate: string; setFaMaturityDate: (v: string) => void
}) {
  return (
    <>
      <SectionDivider label="금융자산 상세" />
      <div className="grid grid-cols-2 gap-3">
        <RateField   label="이자율 / 수익률" value={faInterestRate}   onChange={setFaInterestRate} />
        <NumberField label="월 납입액"        value={faMonthlyPayment} onChange={setFaMonthlyPayment} />
      </div>
      <DateField label="만기일" value={faMaturityDate} onChange={setFaMaturityDate} />
    </>
  )
}

// ─── 연금 (PENSION) ───────────────────────────────────────────────
interface PensionSectionProps {
  pPensionType: PensionType; setPPensionType: (v: PensionType) => void
  pInstitutionName: string; setPInstitutionName: (v: string) => void
  pMonthlyPayment: string; setPMonthlyPayment: (v: string) => void
  pExpectedMonthlyPension: string; setPExpectedMonthlyPension: (v: string) => void
  pPensionStartAge: string; setPPensionStartAge: (v: string) => void
  pOwnerBirthYear: string; setPOwnerBirthYear: (v: string) => void
  pAccumulatedMonths: string; setPAccumulatedMonths: (v: string) => void
}

export function PensionSection(props: PensionSectionProps) {
  const {
    pPensionType, setPPensionType,
    pInstitutionName, setPInstitutionName,
    pMonthlyPayment, setPMonthlyPayment,
    pExpectedMonthlyPension, setPExpectedMonthlyPension,
    pPensionStartAge, setPPensionStartAge,
    pOwnerBirthYear, setPOwnerBirthYear,
    pAccumulatedMonths, setPAccumulatedMonths,
  } = props

  return (
    <>
      <SectionDivider label="연금 상세" />

      {/* 연금 종류 */}
      <div>
        <Label className="text-muted-foreground text-xs mb-1.5 block">연금 종류</Label>
        <div className="relative">
          <select
            value={pPensionType}
            onChange={e => setPPensionType(e.target.value as PensionType)}
            className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-9 text-sm text-foreground outline-hidden focus:border-ring transition-colors appearance-none"
          >
            {PENSION_TYPES_LIST.map(pt => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* 기관명 */}
      <div>
        <Label className="text-muted-foreground text-xs mb-1.5 block">기관명</Label>
        <input
          type="text"
          value={pInstitutionName}
          onChange={e => setPInstitutionName(e.target.value)}
          placeholder="예: 국민연금공단, 삼성생명"
          className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="월 납입액"      value={pMonthlyPayment}           onChange={setPMonthlyPayment} />
        <NumberField label="예상 월 수령액"  value={pExpectedMonthlyPension}    onChange={setPExpectedMonthlyPension} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-muted-foreground text-xs mb-1.5 block">개시 예정 나이</Label>
          <div className="relative">
            <input
              type="number" min="50" max="80" value={pPensionStartAge}
              onChange={e => setPPensionStartAge(e.target.value)}
              placeholder="65"
              className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-10 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">세</span>
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground text-xs mb-1.5 block">출생연도</Label>
          <input
            type="number" min="1940" max="2010" value={pOwnerBirthYear}
            onChange={e => setPOwnerBirthYear(e.target.value)}
            placeholder="1990"
            className="w-full h-10 bg-card border border-border rounded-xl px-4 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-xs mb-1.5 block">납입 개월 수</Label>
          <div className="relative">
            <input
              type="number" min="0" value={pAccumulatedMonths}
              onChange={e => setPAccumulatedMonths(e.target.value)}
              placeholder="0"
              className="w-full h-10 bg-card border border-border rounded-xl pl-4 pr-12 text-sm text-foreground placeholder-muted-foreground/40 outline-hidden focus:border-ring transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">개월</span>
          </div>
        </div>
      </div>
    </>
  )
}
