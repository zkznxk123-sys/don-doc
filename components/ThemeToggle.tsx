'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

const OPTIONS = [
  { value: 'light',  label: '라이트', Icon: Sun },
  { value: 'dark',   label: '다크',   Icon: Moon },
  { value: 'system', label: '시스템', Icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200"
          aria-label="테마 변경"
        >
          {/* mounted 전에는 고정 아이콘 — hydration mismatch 방지 */}
          {mounted && isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(theme === value && 'bg-muted text-foreground')}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {theme === value && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-secondary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
