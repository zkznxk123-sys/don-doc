import { ACCENT, CREAM, CREAM_DIM } from './tokens'

export function Section({
  kicker,
  title,
  body,
  children,
  bg,
}: {
  kicker: string
  title: React.ReactNode
  body?: string
  children?: React.ReactNode
  bg: string
}) {
  return (
    <section
      className="relative px-6 md:px-14 py-20 md:py-[100px]"
      style={{ background: bg }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 lg:gap-20 items-start">
          <div>
            <p
              className="text-[11px] tracking-[0.18em] uppercase font-semibold m-0 mb-5"
              style={{ color: ACCENT }}
            >
              {kicker}
            </p>
            <h2
              className="font-serif font-medium m-0 leading-[1.05] tracking-[-0.025em] text-[40px] sm:text-[48px] lg:text-[56px]"
              style={{ color: CREAM }}
            >
              {title}
            </h2>
          </div>
          {body && (
            <p
              className="text-base lg:text-[16px] leading-[1.7] m-0 pt-3 max-w-[540px]"
              style={{ color: CREAM_DIM }}
            >
              {body}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  )
}
