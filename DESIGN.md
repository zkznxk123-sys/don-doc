# 돈Doc Design System

Family finance dashboard. Warm editorial tone — numbers should feel approachable, not clinical.

---

## Philosophy

**Editorial Finance.** Inspired by financial magazines, not spreadsheets. Warm off-white surfaces, serif display numbers, editorial gold accent. The goal is to make household finance feel calm and readable, not stressful.

Two rules:
1. Numbers are the hero — give them space, weight, and contrast.
2. Warmth over sterility — no cold grays, no blue-tinted whites.

---

## Colors

### Light Mode

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#FCF9F8` | Page canvas — warm off-white |
| `foreground` | `#1A1A1A` | Body text — dark charcoal |
| `card` | `#FFFFFF` | Lifted card surface |
| `primary` | `#1A1A1A` | Primary buttons, strong text |
| `secondary` | `#735C00` | Editorial gold — labels, accents |
| `muted` | `#F6F3F2` | Subtle container background |
| `muted-foreground` | `hsl(20 5% 45%)` | Captions, metadata |
| `accent` | `hsl(47 60% 93%)` | Light gold tint surface |
| `border` | `hsl(20 10% 92%)` | Ghost borders |
| `destructive` | `#BA1A1A` | Errors, delete actions |

### Dark Mode

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#0F172A` | Deep slate canvas |
| `foreground` | `#F1F5F9` | Crisp off-white text |
| `card` | `#1E293B` | Slightly lighter slate surface |
| `secondary` | `#B49B3E` | Luminous gold |
| `ring` | `#B49B3E` | Gold focus ring |

Cards in dark mode: drop shadow → ghost border (`border border-border`).

### Data Visualization Palette

Always use these exact colors for chart/data elements — never arbitrary Tailwind colors.

| Token | Hex | Semantic use |
|-------|-----|--------------|
| `viz-emerald` | `#10b981` | Income, savings, investments |
| `viz-blue` | `#3b82f6` | Cash, links, rate lines |
| `viz-violet` | `#8b5cf6` | AI features, activity feed |
| `viz-purple` | `#c084fc` | Real estate |
| `viz-amber` | `#f59e0b` | Warnings, crypto |
| `viz-orange` | `#f97316` | Expenses |
| `viz-red` | `#ef4444` | Liabilities, destructive |
| `viz-rose` | `#f43f5e` | Credit card |
| `viz-sky` | `#60a5fa` | Cash (light variant) |
| `viz-mint` | `#34d399` | Investments (light variant) |
| `viz-gold` | `#fbbf24` | Crypto (light variant) |

Semantic shorthand utilities: `text-income` (emerald), `text-expense` (red), `text-savings` (blue), `text-warning` (amber). Soft backgrounds: `bg-income-soft`, `bg-expense-soft`, `bg-savings-soft`, `bg-warning-soft` (10% opacity fills).

---

## Typography

### Fonts

- **Sans**: `Pretendard` → `Noto Sans KR` → system-ui (UI labels, body, metadata)
- **Serif**: `Noto Serif KR` → Georgia (display numbers, page titles h1/h2)
- **Mono**: `ui-monospace` / Menlo (code only)

### Scale

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| `h1`, `h2` | Serif | fluid | 700 | `tracking-tight`, `leading-[1.1]` |
| `h3` | Sans | 16px | 600 | Section headings |
| `h4` | Sans | 12px | 600 | Card labels |
| Body | Sans | 14px | 400 | `leading-[1.6]` |
| `.eyebrow` | Sans | 11px | 500 | Uppercase labels above sections, gold color, `tracking-[0.16em]` |
| `.text-meta` | Sans | 11px | 400 | Timestamps, captions — muted |

### Number Display Classes

Use these consistently — never mix serif numbers in UI rows or sans numbers in hero display.

```
.numeric-display   — Serif, 700, tabular-nums, tracking-tight
                     → Hero totals: net worth, total assets on dashboard

.numeric           — Sans, 600, tabular-nums, tracking-[-0.01em]
                     → KPI cards, table rows, transaction amounts

.tabular           — tabular-nums only, no font override
                     → When you just need alignment, not weight
```

---

## Spacing & Layout

- Base font-size: `14px`
- Card padding: `p-6` (24px)
- Section gap: `gap-4` to `gap-6`
- Page max-width: `1400px` (Tailwind `container`)

---

## Border Radius

| Token | Size | Use |
|-------|------|-----|
| `rounded-sm` | 4px | Tag inner icons |
| `rounded` / `rounded-md` | 6px | Buttons, CTAs |
| `rounded-lg` | 8px | Dropdowns, icon containers |
| `rounded-xl` | 12px | Chips, inputs, avatars |
| `rounded-2xl` | 16px | Cards, drawers ← primary card radius |
| `rounded-full` | 9999px | Pills, badges, avatar circles |

Default card shape: `rounded-2xl`.

---

## Shadows

```css
/* Light mode: ambient depth */
shadow-card   → 0 1px 3px rgba(26,26,26,0.06), 0 4px 16px rgba(26,26,26,0.04)
shadow-float  → 0 8px 40px rgba(26,26,26,0.08)
shadow-card-xl → 0 20px 60px rgba(26,26,26,0.12)

/* Dark mode: no shadow — use border border-border instead */
```

---

## Component Patterns

### Card

Standard surface for all dashboard panels.

```tsx
// Light: ambient shadow. Dark: ghost border.
<div className="card-surface p-6">
  ...
</div>

// Equivalent:
<div className="bg-card rounded-2xl shadow-card dark:shadow-none dark:border dark:border-border p-6">
```

### KPI Card

```tsx
<div className="card-surface p-6 space-y-1">
  <p className="eyebrow">순자산</p>
  <p className="numeric-display text-3xl text-foreground">₩12,345,678</p>
  <p className="text-meta">전월 대비 +3.2%</p>
</div>
```

### Transaction Row

```tsx
<div className="flex items-center justify-between py-3 border-b border-border last:border-0">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
      {/* category icon */}
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{description}</p>
      <p className="text-meta">{date} · {category}</p>
    </div>
  </div>
  <span className={cn("numeric text-sm", isExpense ? "text-expense" : "text-income")}>
    {isExpense ? "-" : "+"}{formatCurrency(amount)}
  </span>
</div>
```

### Eyebrow + Section Header

```tsx
<div className="space-y-0.5 mb-4">
  <p className="eyebrow">이번 달</p>
  <h3>현금흐름 요약</h3>
</div>
```

### Income / Expense Badge

```tsx
// Income
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-income-soft text-income">수입</span>

// Expense
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-expense-soft text-expense">지출</span>
```

### Chart Area

Charts use `Recharts` with `ResponsiveContainer`. Always use the `viz-*` palette — do not use arbitrary Tailwind color classes inside charts.

```tsx
// Net worth area chart — canonical color assignments:
// Total assets area: fill="#60a5fa" (viz-sky), stroke="#3b82f6" (viz-blue)
// Net worth area:    fill="#34d399" (viz-mint), stroke="#10b981" (viz-emerald)
// Tooltip: bg-card, border-border, rounded-xl, shadow-xl
```

---

## Brand

- **App name**: 돈Doc
- **Brand mark**: D-shaped letterform + luminous gold dot (`/brand-mark.svg` light, `/brand-mark-dark.svg` dark)
- **Wordmark**: horizontal lockup (`/logo-wordmark.svg`, `/logo-wordmark-dark.svg`)
- **Use `<LogoLockup />` or `<BrandMark />` from `components/ui/brand-mark.tsx`** — never recreate the logo in JSX.

---

## Navigation

Left sidebar. Icon + label. Active item: `bg-muted text-foreground font-medium`. Inactive: `text-muted-foreground hover:bg-muted/50`.

Nav items (in order): 대시보드, 현금흐름 관리, 자산 관리, 예산 관리, 시나리오 허브, 가족 피드, 설정.

Icons from `lucide-react` only.

---

## Do / Don't

| Do | Don't |
|----|-------|
| Use `numeric-display` (serif) for hero totals | Mix serif into table rows or badges |
| Use `eyebrow` for section labels above headings | Use `eyebrow` as a standalone label without a heading below it |
| `rounded-2xl` on cards | `rounded-lg` on cards (too tight) |
| `shadow-card` in light, `border border-border` in dark | Apply shadow in dark mode |
| `viz-*` tokens inside charts | Raw Tailwind colors like `text-emerald-500` in charts |
| Korean UI copy — this is a Korean-language app | English labels in production UI |
| `text-income` / `text-expense` for financial values | `text-green-500` / `text-red-500` ad-hoc |
