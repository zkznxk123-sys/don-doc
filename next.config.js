/** @type {import('next').NextConfig} */
const nextConfig = {
  // @prisma/client은 네이티브 바이너리(.so.node)를 사용하므로
  // webpack이 번들링하지 않고 Node.js가 직접 require()하도록 설정합니다.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
}

module.exports = nextConfig
