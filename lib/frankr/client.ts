'use client'

import type { FrankrCalcType, FrankrResponse, PropertyTaxParams, AcquisitionTaxParams, TransferTaxParams, GiftTaxParams, InheritanceTaxParams } from './types'

// 내부 프록시 API를 통해 Frankr API 호출
async function callFrankr(
  calcType: FrankrCalcType,
  params: Record<string, unknown>
): Promise<FrankrResponse> {
  const res = await fetch('/api/frankr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calcType, params }),
  })
  return res.json()
}

export const frankr = {
  // 보유세 (재산세 + 종합부동산세)
  propertyTax: (params: PropertyTaxParams) =>
    callFrankr('property', params as Record<string, unknown>),

  // 취득세
  acquisitionTax: (params: AcquisitionTaxParams) =>
    callFrankr('acquisition', params as Record<string, unknown>),

  // 양도세
  transferTax: (params: TransferTaxParams) =>
    callFrankr('transfer', params as Record<string, unknown>),

  // 증여세
  giftTax: (params: GiftTaxParams) =>
    callFrankr('give', params as Record<string, unknown>),

  // 상속세
  inheritanceTax: (params: InheritanceTaxParams) =>
    callFrankr('inherit', params as Record<string, unknown>),
}
