'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const LIGHT_APPEARANCE = {
  baseTheme: undefined,
  variables: {
    colorPrimary: '#1A1A1A',
    colorBackground: '#FCF9F8',
    colorInputBackground: '#FFFFFF',
    colorInputText: '#1A1A1A',
    colorText: '#1A1A1A',
    colorTextSecondary: '#735C00',
    colorDanger: '#DC2626',
    borderRadius: '0.375rem',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    // 카드 — No-Line, 앰비언트 섀도만
    card: {
      backgroundColor: '#FFFFFF',
      boxShadow: '0 1px 3px rgba(26,26,26,0.06), 0 4px 16px rgba(26,26,26,0.04)',
      border: 'none',
      borderRadius: '0.5rem',
    },
    // 헤더
    headerTitle: {
      fontFamily: 'var(--font-noto-serif), Georgia, serif',
      fontWeight: '700',
      letterSpacing: '-0.02em',
      color: '#1A1A1A',
    },
    headerSubtitle: {
      color: '#735C00',
    },
    // 소셜 버튼 (공통)
    socialButtonsBlockButton: {
      border: '1px solid rgba(26,26,26,0.10)',
      borderRadius: '0.375rem',
      backgroundColor: '#FFFFFF',
      color: '#1A1A1A',
      fontWeight: '500',
      '&:hover': {
        backgroundColor: '#F6F3F2',
      },
    },
    // 카카오 버튼 — 브랜드 컬러 (#FEE500 노란색)
    'socialButtonsBlockButton__kakao': {
      backgroundColor: '#FEE500',
      borderColor: '#FEE500',
      color: '#191919',
      '&:hover': {
        backgroundColor: '#F0D900',
        borderColor: '#F0D900',
      },
    },
    // 구분선
    dividerLine: {
      backgroundColor: 'rgba(26,26,26,0.08)',
    },
    dividerText: {
      color: '#735C00',
    },
    // 입력창
    formFieldInput: {
      border: '1px solid rgba(26,26,26,0.12)',
      borderRadius: '0.375rem',
      backgroundColor: '#FFFFFF',
      color: '#1A1A1A',
      fontSize: '14px',
      '&:focus': {
        borderColor: '#1A1A1A',
        boxShadow: 'none',
      },
    },
    formFieldLabel: {
      color: '#1A1A1A',
      fontSize: '12px',
      fontWeight: '500',
    },
    // Primary 버튼 — 우리 bg-foreground text-background
    formButtonPrimary: {
      backgroundColor: '#1A1A1A',
      color: '#FFFFFF',
      borderRadius: '0.375rem',
      fontWeight: '600',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: 'rgba(26,26,26,0.85)',
      },
    },
    // 링크
    footerActionLink: {
      color: '#735C00',
      fontWeight: '500',
    },
    identityPreviewText: {
      color: '#1A1A1A',
    },
    formResendCodeLink: {
      color: '#735C00',
    },
  },
} as const

const DARK_APPEARANCE = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#F1F5F9',
    colorBackground: '#0F172A',
    colorInputBackground: '#1E293B',
    colorInputText: '#F1F5F9',
    colorText: '#F1F5F9',
    colorTextSecondary: '#B49B3E',
    colorDanger: '#F87171',
    borderRadius: '0.375rem',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontFamilyButtons: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    card: {
      backgroundColor: '#1E293B',
      boxShadow: 'none',
      border: '1px solid rgba(241,245,249,0.08)',
      borderRadius: '0.5rem',
    },
    headerTitle: {
      fontFamily: 'var(--font-noto-serif), Georgia, serif',
      fontWeight: '700',
      letterSpacing: '-0.02em',
      color: '#F1F5F9',
    },
    headerSubtitle: {
      color: '#B49B3E',
    },
    socialButtonsBlockButton: {
      border: '1px solid rgba(241,245,249,0.10)',
      borderRadius: '0.375rem',
      backgroundColor: 'transparent',
      color: '#F1F5F9',
      fontWeight: '500',
    },
    // 카카오 버튼 — 다크 모드에도 브랜드 컬러 유지
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
      backgroundColor: 'rgba(241,245,249,0.08)',
    },
    dividerText: {
      color: '#B49B3E',
    },
    formFieldInput: {
      border: '1px solid rgba(241,245,249,0.12)',
      borderRadius: '0.375rem',
      backgroundColor: '#1E293B',
      color: '#F1F5F9',
      fontSize: '14px',
    },
    formFieldLabel: {
      color: '#F1F5F9',
      fontSize: '12px',
      fontWeight: '500',
    },
    formButtonPrimary: {
      backgroundColor: '#F1F5F9',
      color: '#0F172A',
      borderRadius: '0.375rem',
      fontWeight: '600',
      fontSize: '14px',
    },
    footerActionLink: {
      color: '#B49B3E',
      fontWeight: '500',
    },
    formResendCodeLink: {
      color: '#B49B3E',
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
