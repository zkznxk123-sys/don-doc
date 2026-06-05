import { CREAM_DIM, CREAM_FAINT } from './tokens'

export function TechStackStrip() {
  return (
    <div
      className="relative py-8 md:py-10"
      style={{ borderTop: `1px solid ${CREAM_FAINT}`, borderBottom: `1px solid ${CREAM_FAINT}` }}
    >
      <p
        className="text-[11px] tracking-[0.18em] uppercase text-center m-0 mb-6"
        style={{ color: CREAM_DIM }}
      >
        엔드 투 엔드로 직접 설계 · 구현
      </p>
      <div className="overflow-hidden whitespace-nowrap">
        <div
          className="inline-flex gap-14 items-center"
          style={{ animation: 'cpTicker 24s linear infinite' }}
        >
          {[...Array(2)].flatMap((_, copy) =>
            ['Next.js 14', 'Prisma 5', 'PostgreSQL', 'Clerk', 'Vercel AI SDK', 'CLIProxyAPI', 'Tailwind', 'shadcn/ui', 'Zod', 'Recharts'].map((p, i) => (
              <span
                key={`${copy}-${i}`}
                className="font-serif font-medium tracking-[-0.02em] text-[20px] sm:text-[22px]"
                style={{
                  color: 'rgba(241,236,227,0.4)',
                  fontStyle: i % 3 === 0 ? 'italic' : 'normal',
                }}
              >
                {p}
              </span>
            )),
          )}
        </div>
      </div>
    </div>
  )
}
