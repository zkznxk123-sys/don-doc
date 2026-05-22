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
}

module.exports = nextConfig
