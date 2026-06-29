/**
 * 공모주 청약 원장 — 일정 공지 파싱용 타입.
 *
 * 북극성: "운영자가 매일 손으로 올리는 공모주 일정 공지를 그대로 캘린더/알림으로."
 * 입력은 카톡 텍스트 1건, 출력은 날짜가 박힌 원자 이벤트(IpoScheduleEvent[]).
 * 이벤트를 종목 단위로 접으면(mergeEventsToOfferings) 부분 Offering이 된다.
 *
 * (전체 원장 엔티티 설계는 vault `공모주-청약원장-데이터모델-스펙.md` 참조.
 *  본 파일은 schedule-notice 어댑터에 필요한 최소 타입만.)
 */

/** 일정 공지의 4개 라벨. */
export type IpoEventKind = 'LISTING' | 'SUBSCRIPTION' | 'REFUND' | 'TRANSFER'

/** 라벨 라인 1건 = 날짜 + 종류 + 종목(+증권사들). */
export interface IpoScheduleEvent {
  date: string            // "YYYY-MM-DD" — 공지 헤더 + 메시지 연도로 확정
  kind: IpoEventKind
  stockName: string
  brokers: string[]       // 괄호 안 증권사 다건("케이뱅크(NH, 삼성, 신한)" → 3개)
  raw: string             // 원본 토큰 — HITL 보정·투명성용
}

/** 어댑터 입력 — 공지 텍스트 1건 + 수신 시각(연도 추론용). */
export interface ScheduleNoticeInput {
  text: string
  receivedAt: string      // 메시지 타임스탬프. "YYYY-MM-DD ..." 형태면 충분
}

/** 이벤트를 종목 단위로 접은 부분 Offering(스펙 Offering의 일정 부분집합). */
export interface ScheduleOffering {
  name: string
  kind: 'IPO' | 'SPAC'
  brokers: string[]       // 청약 가능 증권사 합집합
  subStart?: string       // 청약 시작(=최초 청약 이벤트 날짜)
  subEnd?: string         // 청약 마감(=마지막 청약 이벤트 날짜)
  refundDate?: string
  listingDate?: string
  transferDate?: string
}

/** 한글 라벨 → 이벤트 종류. */
export const LABEL_TO_KIND: Record<string, IpoEventKind> = {
  상장: 'LISTING',
  청약: 'SUBSCRIPTION',
  환불: 'REFUND',
  이체: 'TRANSFER',
}
