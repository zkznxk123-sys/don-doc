'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export function InputGuide() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <p className="px-4 pt-3.5 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
        입력 가이드
      </p>
      <Accordion type="multiple">
        <AccordionItem value="banksalad">
          <AccordionTrigger>📥 뱅크샐러드 엑셀 추출 방법</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              <li>• <span className="text-zinc-300">매월 1일</span>에 지난달 전체 내역을 추출하는 것을 권장해요.</li>
              <li>• 뱅크샐러드 앱 → 가계부 탭 → 우측 상단 <span className="text-zinc-300">내보내기(↑)</span> 버튼</li>
              <li>• 기간: <span className="text-zinc-300">지난달 1일 ~ 말일</span> 기준으로 설정</li>
              <li>• 파일 형식: <span className="text-zinc-300">엑셀(.xlsx)</span> 선택 후 저장</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="routine">
          <AccordionTrigger>🗓️ 추천하는 패밀리 오피스 기록 루틴</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              <li>• <span className="text-zinc-300">카드 내역</span>은 월 1회 엑셀 일괄 업로드로 처리</li>
              <li>• <span className="text-zinc-300">현금 지출 / 개인 송금</span>처럼 카드 명세에 안 잡히는 항목만 수기 입력</li>
              <li>• 업로드 후 <span className="text-zinc-300">중복 감지</span>가 자동으로 처리되므로 여러 번 올려도 괜찮아요</li>
              <li>• 가족 구성원 각자가 월초에 한 번씩 올리면 CFO가 한눈에 파악 가능</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="category">
          <AccordionTrigger>✏️ 카테고리 일괄 정리 팁</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              <li>• 업로드 후 <span className="text-zinc-300">현금흐름 탭</span>으로 이동</li>
              <li>• 상단 <span className="text-zinc-300">[편집] 버튼</span>을 눌러 편집 모드 진입</li>
              <li>• 각 내역의 카테고리 드롭다운을 변경하고, <span className="text-zinc-300">[저장]</span>으로 일괄 반영</li>
              <li>• 통계에서 제외할 이체·환급 항목은 <span className="text-zinc-300">[제외] 체크</span>로 처리하세요</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
