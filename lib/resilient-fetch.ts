/**
 * 침묵 실패 방지용 JSON fetch (2026-08-10). 네트워크 순단·비2xx·success:false면 재시도하고,
 * 최종 실패 시 throw 한다 → 호출부가 catch해서 "조용한 0" 대신 에러 배너를 띄우게 한다.
 * (대시보드 8/8 사고: 로드 실패를 if(success){} else 없이 삼켜 순자산·거래가 0으로 보임)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchJsonWithRetry(url: string, opts?: { retries?: number }): Promise<any> {
  const retries = opts?.retries ?? 2
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (res.ok && json?.success) return json
      lastErr = new Error(json?.error || `HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
  }
  throw lastErr ?? new Error('불러오기 실패')
}
