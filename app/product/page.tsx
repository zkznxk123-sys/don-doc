import type { Metadata } from 'next'
import { ProductPage } from '@/components/marketing/ProductPage'

export const metadata: Metadata = {
  title: '제품 · 돈독 — 흩어진 자산을 한 화면에',
  description: '현금·금융·부동산·연금·부채를 한 곳에. 엑셀 한 번 업로드로 AI가 분류까지 끝내는 자산 통합 관리.',
}

export default function Product() {
  return <ProductPage />
}
