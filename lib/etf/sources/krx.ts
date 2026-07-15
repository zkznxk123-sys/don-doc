/**
 * KRX 정보데이터시스템 ETF 자산구성내역(PDF) 어댑터 — 미구현 stub.
 *
 * KRX는 국내 ETF 전체 구성종목(예: KODEX200 201개)과 국내상장 해외 ETF의 해외 구성종목
 * (예: TIGER 미국S&P500 504개)을 모두 제공한다. 확보되면 registry 최우선 소스로서
 * 국내·해외 양쪽을 full 커버리지로 대체한다(KIS 상위30·지수근사의 한계 극복).
 *
 * 2026-07-15 현재: data.krx.co.kr 정보데이터시스템 경로가 403(점검/장애 추정, 서버는 정상).
 * 복구 확인 후 fetchComposition 구현 → supports를 true로. 계산·registry·UI는 이미 소스 독립적이라
 * 이 파일의 estimateNav만 채우면 정밀 합산으로 승격된다.
 */
import type { EtfNavSource } from '../types'

export const krxSource: EtfNavSource = {
  id: 'krx',
  supports: () => false, // TODO(krx-복구): true + estimateNav 구현
  async estimateNav() {
    return null
  },
}
