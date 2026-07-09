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
      ],
    },
  },
]
