'use client'

import { useState } from 'react'
import {
  Clock, AlertTriangle, CheckCircle2, Bot, ShoppingCart,
} from 'lucide-react'
import type { ScenarioExpansion } from '@/lib/actions/scenario'
import { BrokerAgentPanel } from './BrokerAgentPanel'

export function ExpansionView({ expansion }: { expansion: ScenarioExpansion }) {
  const [agentOpen, setAgentOpen] = useState(false)
  return (
    <div className="space-y-4">
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
        <p className="text-xs text-indigo-400 font-medium mb-1">실행 개요</p>
        <p className="text-sm text-foreground/90">{expansion.overview}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">단계별 실행 계획</p>
        {expansion.steps.map((step, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-foreground">{step.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />{step.duration}
              </span>
            </div>
            <div className="px-4 py-2.5 space-y-1.5">
              {step.actions.map((a, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0 mt-1.5" />
                  <span className="text-xs text-foreground/80">{a}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                <CheckCircle2 className="w-3 h-3 text-income flex-shrink-0" />
                <span className="text-[11px] text-income">{step.milestone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expansion.resources.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">필요 자원</p>
          <div className="flex flex-wrap gap-1.5">
            {expansion.resources.map((r, i) => (
              <span key={i} className="text-[11px] bg-muted px-2.5 py-1 rounded-lg text-foreground/70">{r}</span>
            ))}
          </div>
        </div>
      )}

      {expansion.risks.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">리스크 & 대응</p>
          <div className="space-y-1.5">
            {expansion.risks.map((r, i) => (
              <div key={i} className="bg-warning-soft border border-warning/20 rounded-xl px-3 py-2">
                <p className="text-xs font-medium text-warning flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />{r.risk}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">→ {r.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-income-soft border border-border/30 rounded-xl px-4 py-3">
        <p className="text-[10px] text-income font-medium mb-1">성공 기준</p>
        <p className="text-xs text-foreground/80">{expansion.successMetric}</p>
      </div>

      {/* 에이전트 실행 — KIS 브로커 연동 검증 후 활성화 (feat/kis-broker 브랜치 참조) */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
      {false && (
        <>
          <button
            onClick={() => setAgentOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-500 dark:text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            AI 에이전트로 실행하기
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>

          {agentOpen && (
            <BrokerAgentPanel
              scenarioPlanText={JSON.stringify(expansion)}
              onClose={() => setAgentOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
