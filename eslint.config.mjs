import nextConfig from 'eslint-config-next'

export default [
  {
    // .js/.mjs/.cjs 전역 무시: eslint-config-next의 next 프리셋이 번들 babel 파서를 써서
    // eslint@10과 비호환(scopeManager.addGlobals 크래시). 앱 코드는 전부 ts/tsx라 커버리지 영향 없음.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**', '**/*.js', '**/*.mjs', '**/*.cjs'],
  },
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  {
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      react: { version: '19' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react/no-unescaped-entities': 'warn',
      // React 19 + new hook rules. 후속 라운드에서 effect → action·useEffectEvent로 리팩토링 예정
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      // static-components/refs 도 같은 React 19 신규 규칙 계열 — 후속 리팩토링 전까지 warn (기존 error → 빌드 차단 방지)
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/\\b(text|bg|border|ring|hover:text|hover:bg|hover:border)-(emerald|red|amber|orange|rose)-(400|500|600)\\b/]',
          message: 'Use viz tokens (.text-income / .text-expense / .text-warning / .text-savings / .bg-income-soft / destructive 등) instead of ad-hoc Tailwind colors. See BRAND_GUIDE §7 and CLAUDE.md.',
        },
        {
          // 콜드 팔레트 rgba 리터럴 (style={{}} 인라인) — 웜 통일(5625c96)의 사각지대(design 07-19-v2).
          // emerald 16,185,129 / amber 245,158,11 / red 239,68,68 / blue 59,130,246 / violet 139,92,246
          selector: 'Literal[value=/rgba\\((16, ?185, ?129|245, ?158, ?11|239, ?68, ?68|59, ?130, ?246|139, ?92, ?246)/]',
          message: '콜드 팔레트 rgba 금지 — color-mix(in srgb, var(--viz-sage|copper|terra|slate) N%, transparent) 사용. BRAND_GUIDE §7.',
        },
      ],
    },
  },
  {
    // 'use server' 파일 재export 하드 가드 (2026-08-13, AGENTS.md 규칙의 코드화).
    // export type { X } 재export를 두면 Next가 액션 매니페스트에 값으로 등록해 그 모듈을
    // import하는 모든 서버 액션 POST가 ReferenceError 500 (2026-08-03 장애, 514370a).
    // _*.ts 헬퍼(no 'use server')는 제외. 선언문(export interface/type alias/async function)은 허용.
    files: ['lib/actions/**/*.ts'],
    ignores: ['lib/actions/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Program:has(> ExpressionStatement[directive='use server']) > ExportAllDeclaration",
          message: "'use server' 파일에서 export * 금지 — 액션 매니페스트 오염(2026-08-03 장애). 타입·상수는 순수 모듈에 두고 소비자가 직접 import.",
        },
        {
          selector: "Program:has(> ExpressionStatement[directive='use server']) > ExportNamedDeclaration[source]",
          message: "'use server' 파일에서 재export(export { X } from / export type { X } from) 금지 — 액션 매니페스트 오염(2026-08-03 장애). 타입·상수는 순수 모듈에 두고 소비자가 직접 import.",
        },
        {
          selector: "Program:has(> ExpressionStatement[directive='use server']) > ExportNamedDeclaration > VariableDeclaration",
          message: "'use server' 파일에서 값 export 금지 — async 함수만 export 가능. 상수는 순수 모듈(lib/*-calc.ts 등)로.",
        },
      ],
    },
  },
  {
    // IPO 소비 표면 — raw 팔레트 재유입 하드 차단 (designer 7/10, 무지개 2차 재발 방지).
    // 두 축을 한 규칙에 배열로 둔다: ① 팔레트명(emerald-500 류) ② 브라켓 임의값·style raw hex.
    // ②는 기존 팔레트명 정규식이 못 잡던 사각지대(dev/designer 2026-07-13 라운드2 발견:
    //   hover:text-[#C0553D]·style={{color:'#...'}} 통과) 보완. tones.ts는 아래 별도 블록에서 ①만.
    files: ['components/ipo/schedule-view.tsx', 'components/ipo/account-planner.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(emerald|amber|rose|sky|violet|indigo|teal|cyan|lime|fuchsia|blue|green|red|orange|yellow|pink|purple)-[0-9]/]',
          message: 'IPO 화면은 웜 시맨틱 톤(components/ipo/tones.ts)만 사용 — raw Tailwind 팔레트 금지 (BRAND_GUIDE §7, design 2026-07-10).',
        },
        {
          selector: 'Literal[value=/(\\[#[0-9A-Fa-f]{3,8}\\]|^#[0-9A-Fa-f]{3,8}$)/]',
          message: 'raw hex(브라켓 임의값·style 리터럴 포함) 금지 — components/ipo/tones.ts 시맨틱 토큰을 쓰거나 새 토큰을 그곳에 추가할 것 (BRAND_GUIDE §7).',
        },
      ],
    },
  },
  {
    // tones.ts = 시맨틱 색 소스 — 브라켓 hex는 여기서 정당하게 정의되므로 hex 규칙 제외.
    // 팔레트명(emerald-500 류)만 차단해 ad-hoc Tailwind 색 유입은 막는다.
    files: ['components/ipo/tones.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(emerald|amber|rose|sky|violet|indigo|teal|cyan|lime|fuchsia|blue|green|red|orange|yellow|pink|purple)-[0-9]/]',
          message: 'IPO 화면은 웜 시맨틱 톤만 사용 — raw Tailwind 팔레트 금지 (BRAND_GUIDE §7, design 2026-07-10).',
        },
      ],
    },
  },
]
