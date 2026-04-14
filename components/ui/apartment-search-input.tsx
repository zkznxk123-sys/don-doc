'use client'

import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Search, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApartmentResult {
  name: string
  address: string
  roadAddress: string
  bjdCode: string | null
  x: string
  y: string
}

// 시도 → 시군구 → bjdCode 매핑
const REGION_DATA: Record<string, Record<string, string>> = {
  '서울': {
    '종로구': '11110', '중구': '11140', '용산구': '11170', '성동구': '11200',
    '광진구': '11215', '동대문구': '11230', '중랑구': '11260', '성북구': '11290',
    '강북구': '11305', '도봉구': '11320', '노원구': '11350', '은평구': '11380',
    '서대문구': '11410', '마포구': '11440', '양천구': '11470', '강서구': '11500',
    '구로구': '11530', '금천구': '11545', '영등포구': '11560', '동작구': '11590',
    '관악구': '11620', '서초구': '11650', '강남구': '11680', '송파구': '11710',
    '강동구': '11740',
  },
  '경기': {
    '수원시 장안구': '41111', '수원시 권선구': '41113', '수원시 팔달구': '41115', '수원시 영통구': '41117',
    '성남시 수정구': '41131', '성남시 중원구': '41133', '성남시 분당구': '41135',
    '의정부시': '41150', '안양시 만안구': '41171', '안양시 동안구': '41173',
    '부천시': '41190', '광명시': '41210', '평택시': '41220', '동두천시': '41250',
    '안산시 상록구': '41271', '안산시 단원구': '41273', '고양시 덕양구': '41281',
    '고양시 일산동구': '41285', '고양시 일산서구': '41287', '과천시': '41290',
    '구리시': '41310', '남양주시': '41360', '오산시': '41370', '시흥시': '41390',
    '군포시': '41410', '의왕시': '41430', '하남시': '41450', '용인시 처인구': '41461',
    '용인시 기흥구': '41463', '용인시 수지구': '41465', '파주시': '41480',
    '이천시': '41500', '안성시': '41550', '김포시': '41570', '화성시': '41590',
    '광주시': '41610', '양주시': '41630', '포천시': '41650', '여주시': '41670',
    '연천군': '41800', '가평군': '41820', '양평군': '41830',
  },
  '인천': {
    '중구': '28110', '동구': '28140', '미추홀구': '28177', '연수구': '28185',
    '남동구': '28200', '부평구': '28237', '계양구': '28245', '서구': '28260',
    '강화군': '28710', '옹진군': '28720',
  },
  '부산': {
    '중구': '26110', '서구': '26140', '동구': '26170', '영도구': '26200',
    '부산진구': '26230', '동래구': '26260', '남구': '26290', '북구': '26320',
    '해운대구': '26350', '사하구': '26380', '금정구': '26410', '강서구': '26440',
    '연제구': '26470', '수영구': '26500', '사상구': '26530', '기장군': '26710',
  },
  '대구': {
    '중구': '27110', '동구': '27140', '서구': '27170', '남구': '27200',
    '북구': '27230', '수성구': '27260', '달서구': '27290', '달성군': '27710',
  },
  '대전': {
    '동구': '30110', '중구': '30140', '서구': '30170', '유성구': '30200', '대덕구': '30230',
  },
  '광주': {
    '동구': '29110', '서구': '29140', '남구': '29155', '북구': '29170', '광산구': '29200',
  },
  '울산': {
    '중구': '31110', '남구': '31140', '동구': '31170', '북구': '31200', '울주군': '31710',
  },
  '세종': {
    '세종시': '36110',
  },
  '충북': {
    '청주시 상당구': '43111', '청주시 서원구': '43113', '청주시 흥덕구': '43114', '청주시 청원구': '43115',
    '충주시': '43130', '제천시': '43150', '보은군': '43720', '옥천군': '43730', '영동군': '43740',
  },
  '충남': {
    '천안시 동남구': '44131', '천안시 서북구': '44133', '공주시': '44150', '보령시': '44180',
    '아산시': '44200', '서산시': '44210', '논산시': '44230', '계룡시': '44250', '당진시': '44270',
  },
  '전북': {
    '전주시 완산구': '45111', '전주시 덕진구': '45113', '군산시': '45130', '익산시': '45140',
    '정읍시': '45180', '남원시': '45190', '김제시': '45210',
  },
  '전남': {
    '목포시': '46110', '여수시': '46130', '순천시': '46150', '나주시': '46170',
    '광양시': '46230',
  },
  '경북': {
    '포항시 남구': '47111', '포항시 북구': '47113', '경주시': '47130', '김천시': '47150',
    '안동시': '47170', '구미시': '47190', '영주시': '47210', '영천시': '47230',
    '상주시': '47250', '문경시': '47280', '경산시': '47290',
  },
  '경남': {
    '창원시 의창구': '48121', '창원시 성산구': '48123', '창원시 마산합포구': '48125',
    '창원시 마산회원구': '48127', '창원시 진해구': '48129',
    '진주시': '48170', '통영시': '48220', '사천시': '48240', '김해시': '48250',
    '밀양시': '48270', '거제시': '48310', '양산시': '48330',
  },
  '강원': {
    '춘천시': '51110', '원주시': '51130', '강릉시': '51150', '동해시': '51170',
    '태백시': '51190', '속초시': '51210', '삼척시': '51230',
  },
  '제주': {
    '제주시': '50110', '서귀포시': '50130',
  },
}

interface Complex {
  name: string
  code: string
}

interface ApartmentSearchInputProps {
  value: string
  bjdCode?: string | null
  area?: number | null
  onSelect: (result: ApartmentResult) => void
  onClear?: () => void
  placeholder?: string
  className?: string
}

// bjdCode → { sido, sigungu } 역방향 조회
function reverseLookup(code: string): { sido: string; sigungu: string } | null {
  for (const [s, gunguMap] of Object.entries(REGION_DATA)) {
    for (const [g, c] of Object.entries(gunguMap)) {
      if (c === code) return { sido: s, sigungu: g }
    }
  }
  return null
}

export function ApartmentSearchInput({
  value,
  bjdCode,
  area,
  onSelect,
  onClear,
  placeholder = '단지명 검색',
  className,
}: ApartmentSearchInputProps) {
  const initial = bjdCode ? reverseLookup(bjdCode) : null
  const [sido, setSido]             = useState(initial?.sido ?? '')
  const [sigungu, setSigungu]       = useState(initial?.sigungu ?? '')
  const [query, setQuery]           = useState(value)
  const [complexes, setComplexes]   = useState<Complex[]>([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const [selected, setSelected]     = useState<Complex | null>(
    value ? { name: value, code: '' } : null
  )
  const wrapperRef = useRef<HTMLDivElement>(null)

  // bjdCode prop이 외부에서 바뀌면 시도/시군구 동기화
  useEffect(() => {
    if (bjdCode) {
      const found = reverseLookup(bjdCode)
      if (found) {
        setSido(found.sido)
        setSigungu(found.sigungu)
      }
    }
  }, [bjdCode])

  const sigunguList   = sido ? Object.keys(REGION_DATA[sido] ?? {}) : []
  const activeBjdCode = sido && sigungu ? (REGION_DATA[sido]?.[sigungu] ?? null) : null

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 시군구 선택 시 단지 목록 로드
  useEffect(() => {
    if (!activeBjdCode) {
      setComplexes([])
      return
    }
    setLoading(true)
    setComplexes([])
    fetch(`/api/realestate/complexes?bjdCode=${activeBjdCode}`)
      .then(r => r.json())
      .then(data => setComplexes(data.complexes ?? []))
      .catch(() => setComplexes([]))
      .finally(() => setLoading(false))
  }, [activeBjdCode])

  const filtered = query.trim()
    ? complexes.filter(c => c.name.includes(query.trim()))
    : complexes.slice(0, 50)

  const handleSelect = (c: Complex) => {
    setSelected(c)
    setQuery(c.name)
    setOpen(false)
    onSelect({
      name: c.name,
      address: sido && sigungu ? `${sido} ${sigungu}` : '',
      roadAddress: '',
      bjdCode: activeBjdCode,
      x: '',
      y: '',
    })
  }

  const handleClear = () => {
    setSelected(null)
    setQuery('')
    setSido('')
    setSigungu('')
    setComplexes([])
    onClear?.()
  }

  // 지역 미선택이어도 드롭다운을 열어서 안내 메시지 표시
  const showDropdown = open

  return (
    <div className={cn('space-y-2', className)} ref={wrapperRef}>
      {/* 지역 선택 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <select
            value={sido}
            onChange={e => {
              setSido(e.target.value)
              setSigungu('')
              setSelected(null)
              setQuery('')
              setComplexes([])
            }}
            className="w-full h-9 bg-card border border-border rounded-xl pl-3 pr-8 text-xs text-foreground outline-none focus:border-ring transition-colors appearance-none"
          >
            <option value="">시/도 선택</option>
            {Object.keys(REGION_DATA).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={sigungu}
            onChange={e => {
              setSigungu(e.target.value)
              setSelected(null)
              setQuery('')
            }}
            disabled={!sido}
            className="w-full h-9 bg-card border border-border rounded-xl pl-3 pr-8 text-xs text-foreground outline-none focus:border-ring transition-colors appearance-none disabled:opacity-40"
          >
            <option value="">시군구 선택</option>
            {sigunguList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* 단지명 검색 */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setOpen(true)
              if (selected && e.target.value !== selected.name) setSelected(null)
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={false}
            className="w-full h-10 bg-card border border-border rounded-xl pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-ring transition-colors disabled:opacity-50"
          />
          {(query || selected) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 자동완성 드롭다운 */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
            {!activeBjdCode ? (
              <div className="py-3 px-4 text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                위에서 시/도와 시군구를 먼저 선택해주세요
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                단지 목록 불러오는 중…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-3 px-4 text-xs text-muted-foreground">
                {query.trim() ? `'${query}' 검색 결과 없음` : '단지명을 입력하세요'}
              </div>
            ) : (
              <ul className="max-h-52 overflow-y-auto divide-y divide-border/40">
                {filtered.map(c => (
                  <li key={c.code || c.name}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{c.name}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 50 && !query.trim() && (
                  <li className="px-4 py-2 text-[10px] text-muted-foreground text-center bg-muted/30">
                    단지명을 입력하면 더 정확하게 검색됩니다
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 선택 완료 상태 */}
      {selected && activeBjdCode && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
            <MapPin className="w-2.5 h-2.5" />
            {sido} {sigungu} · 지역코드 {activeBjdCode}
          </span>
          {area && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {area.toFixed(1)}㎡ ({Math.round(area / 3.305)}평)
            </span>
          )}
        </div>
      )}

      {/* 기존 bjdCode만 있는 경우 (수정 시) */}
      {!activeBjdCode && bjdCode && value && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
            <MapPin className="w-2.5 h-2.5" />
            지역코드 {bjdCode}
          </span>
          {area && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {area.toFixed(1)}㎡ ({Math.round(area / 3.305)}평)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
