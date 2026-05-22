/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15: prisma는 서버 외부 번들로
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // 자주 쓰는 큰 패키지의 트리쉐이킹/콜드스타트 단축
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // .eslintrc.json 추가 후 typescript-eslint 룰 정의가 깨져 Vercel build 실패. lint 단계를 빌드에서 분리.
  // 로컬에서는 `npm run lint`로 명시적으로 검사 (viz 토큰 강제 룰 유효).
  eslint: { ignoreDuringBuilds: true },
}

module.exports = nextConfig
