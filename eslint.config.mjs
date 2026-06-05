import nextConfig from 'eslint-config-next'

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**'],
  },
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  {
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
