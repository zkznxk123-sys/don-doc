import Link from 'next/link'
import Image from 'next/image'
import { BG, INK, INK_DIM } from './tokens'

export function Nav() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-6 md:px-14 py-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand-mark.svg"
            alt="돈독"
            width={32}
            height={32}
            priority
          />
          <span className="font-black text-[16px] tracking-[-0.02em]" style={{ color: INK }}>
            돈독
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/demo"
          className="hidden sm:inline-flex text-[12px] px-3 py-1.5 hover:opacity-80"
          style={{ color: INK_DIM }}
        >
          데모
        </a>
        <Link
          href="/sign-in"
          className="text-[12px] px-3 py-1.5 hover:opacity-80"
          style={{ color: INK_DIM }}
        >
          로그인
        </Link>
        <Link
          href="/sign-up"
          className="text-[12px] font-semibold px-[18px] py-2.5 rounded-full transition hover:opacity-90"
          style={{ background: INK, color: BG }}
        >
          무료 시작
        </Link>
      </div>
    </nav>
  )
}
