import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoLockup } from '@/components/ui/brand-mark'
import { NAV_ITEMS, type PageKey } from '../_shared'

export function DemoSidebar({ activePage, onNav, open, onClose, familyName }: {
  activePage: PageKey; onNav: (p: PageKey) => void
  open: boolean; onClose: () => void; familyName: string
}) {
  return (
    <>
      {/* 모바일 오버레이 */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border/60 transition-all duration-200 shrink-0',
        open ? 'w-56' : 'w-0 lg:w-[60px] overflow-hidden',
      )}>
        {/* 브랜드 */}
        <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-border/60 shrink-0', !open && 'lg:justify-center lg:px-0')}>
          <LogoLockup showText={false} size="md" />
          {open && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate font-serif tracking-tight">돈Doc</p>
              <p className="text-[10px] text-muted-foreground truncate">{familyName}</p>
            </div>
          )}
          {open && (
            <button onClick={onClose} className="p-1 text-muted-foreground/60 hover:text-foreground lg:hidden shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* 메뉴 */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = activePage === item.key
            const Icon = item.icon
            return (
              <button key={item.key} onClick={() => { onNav(item.key); onClose() }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/80 hover:bg-muted',
                  !open && 'lg:justify-center lg:px-0',
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {open && <span className="truncate flex-1 text-left">{item.label}</span>}
              </button>
            )
          })}
        </nav>
        {/* 데모 배지 */}
        {open && (
          <div className="px-3 pb-3">
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-violet-400 font-medium">시연용 데이터</p>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
