'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

// Solid Modern — 라이트(페이퍼+포레스트 잉크, CTA 골드)
const LIGHT_APPEARANCE = {
  baseTheme: undefined,
  variables: {
    colorPrimary: '#182A24',
    colorBackground: '#F5F3EE',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#182A24',
    colorText: '#182A24',
    colorTextSecondary: 'rgba(24,42,36,0.55)',
    colorDanger: '#C0553D',
    borderRadius: '0.375rem',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    card: {
      backgroundColor: '#FFFFFF',
      boxShadow: '0 1px 3px rgba(24,42,36,0.06), 0 4px 16px rgba(24,42,36,0.05)',
      border: 'none',
      borderRadius: '0.5rem',
    },
    headerTitle: {
      fontFamily: 'var(--font-sans), sans-serif',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      color: '#182A24',
    },
    headerSubtitle: {
      color: 'rgba(24,42,36,0.55)',
    },
    socialButtonsBlockButton: {
      border: '1px solid rgba(24,42,36,0.12)',
      borderRadius: '0.375rem',
      backgroundColor: '#FFFFFF',
      color: '#182A24',
      fontWeight: '500',
      '&:hover': {
        backgroundColor: '#F2EFE7',
      },
    },
    'socialButtonsBlockButton__kakao': {
      backgroundColor: '#FEE500',
      borderColor: '#FEE500',
      color: '#191919',
      '&:hover': {
        backgroundColor: '#F0D900',
        borderColor: '#F0D900',
      },
    },
    dividerLine: {
      backgroundColor: 'rgba(24,42,36,0.08)',
    },
    dividerText: {
      color: 'rgba(24,42,36,0.5)',
    },
    formFieldInput: {
      border: '1px solid rgba(24,42,36,0.14)',
      borderRadius: '0.375rem',
      backgroundColor: '#FFFFFF',
      color: '#182A24',
      fontSize: '14px',
      '&:focus': {
        borderColor: '#B88A2A',
        boxShadow: 'none',
      },
    },
    formFieldLabel: {
      color: '#182A24',
      fontSize: '12px',
      fontWeight: '500',
    },
    // Primary CTA — 골드(브랜드 액션)
    formButtonPrimary: {
      backgroundColor: '#B88A2A',
      color: '#182A24',
      borderRadius: '0.375rem',
      fontWeight: '700',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#a67c25',
      },
    },
    footerActionLink: {
      color: '#B88A2A',
      fontWeight: '500',
    },
    identityPreviewText: {
      color: '#182A24',
    },
    formResendCodeLink: {
      color: '#B88A2A',
    },
  },
} as const

// Solid Modern — 다크(딥 포레스트+골드, CTA 골드)
const DARK_APPEARANCE = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#C9A54A',
    colorBackground: '#182A24',
    colorInputBackground: '#1F2E28',
    colorInputText: '#F4F1E9',
    colorText: '#F4F1E9',
    colorTextSecondary: 'rgba(244,241,233,0.6)',
    colorDanger: '#D9765E',
    borderRadius: '0.375rem',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    card: {
      backgroundColor: '#1F2E28',
      boxShadow: 'none',
      border: '1px solid rgba(201,165,74,0.18)',
      borderRadius: '0.5rem',
    },
    headerTitle: {
      fontFamily: 'var(--font-sans), sans-serif',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      color: '#F4F1E9',
    },
    headerSubtitle: {
      color: 'rgba(244,241,233,0.6)',
    },
    socialButtonsBlockButton: {
      border: '1px solid rgba(244,241,233,0.12)',
      borderRadius: '0.375rem',
      backgroundColor: 'transparent',
      color: '#F4F1E9',
      fontWeight: '500',
      '&:hover': {
        backgroundColor: 'rgba(244,241,233,0.05)',
      },
    },
    'socialButtonsBlockButton__kakao': {
      backgroundColor: '#FEE500',
      borderColor: '#FEE500',
      color: '#191919',
      '&:hover': {
        backgroundColor: '#F0D900',
        borderColor: '#F0D900',
      },
    },
    dividerLine: {
      backgroundColor: 'rgba(244,241,233,0.1)',
    },
    dividerText: {
      color: 'rgba(244,241,233,0.5)',
    },
    formFieldInput: {
      border: '1px solid rgba(201,165,74,0.2)',
      borderRadius: '0.375rem',
      backgroundColor: '#1F2E28',
      color: '#F4F1E9',
      fontSize: '14px',
      '&:focus': {
        borderColor: '#C9A54A',
        boxShadow: 'none',
      },
    },
    formFieldLabel: {
      color: '#F4F1E9',
      fontSize: '12px',
      fontWeight: '500',
    },
    // Primary CTA — 골드
    formButtonPrimary: {
      backgroundColor: '#C9A54A',
      color: '#182A24',
      borderRadius: '0.375rem',
      fontWeight: '700',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#d4b45f',
      },
    },
    footerActionLink: {
      color: '#C9A54A',
      fontWeight: '500',
    },
    formResendCodeLink: {
      color: '#C9A54A',
    },
  },
} as const

export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const appearance = mounted && resolvedTheme === 'dark' ? DARK_APPEARANCE : LIGHT_APPEARANCE

  return (
    <ClerkProvider appearance={appearance}>
      {children}
    </ClerkProvider>
  )
}
