# Digital Family Office

초고액 자산가용 디지털 패밀리오피스 플랫폼

## 주요 기능

- **선별적 투명성**: 가족 간의 금융 신뢰와 개인 프라이버시 균형
- **자산 관리**: 실시간 자산 현황 및 포트폴리오 분석
- **거래 내역**: 공유/개인 지출 구분 관리
- **투자 성과**: 수익률 및 리스크 분석

## 기술 스택

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS (Dark Mode)
- **UI Components**: Shadcn/ui + Lucide React
- **Charts**: Recharts
- **Database**: Supabase
- **Validation**: Zod

## 시작하기

```bash
# 설치
npm install

# 개발 서버
npm run dev

# 빌드
npm run build
```

## 주요 원칙

1. **선별적 투명성**: 모든 데이터는 `visibility` 필드를 가짐
   - `SHARED`: 모든 가족 구성원에게 공개
   - `PRIVATE`: 본인만 상세 내역 확인 가능

2. **데이터 마스킹**: 타인의 PRIVATE 데이터는 '🔒 개인 지출'으로 표시

3. **역할 기반 뷰**: 관리자(CFO)와 구성원 모드에 따른 대시보드 차별화

## 디자인

- Maybe.finance 스타일의 미니멀한 다크모드 디자인
- 크고 명확한 Typography로 숫자를 '경험'으로 표현
- 시각적 그래프와 카드 형태의 위젯 활용
