'use client'

import type { FrankrCalcType, FrankrResponse, PropertyTaxParams, AcquisitionTaxParams, TransferTaxParams, GiftTaxParams, InheritanceTaxParams } from './types'

// 내부 프록시 API를 통해 Frankr API 호출
async function callFrankr(
  calcType: FrankrCalcType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
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
  propertyTax: (params: PropertyTaxParams) => callFrankr('property', params),
  acquisitionTax: (params: AcquisitionTaxParams) => callFrankr('acquisition', params),
  transferTax: (params: TransferTaxParams) => callFrankr('transfer', params),
  giftTax: (params: GiftTaxParams) => callFrankr('give', params),
  inheritanceTax: (params: InheritanceTaxParams) => callFrankr('inherit', params),
}
