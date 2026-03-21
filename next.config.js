/** @type {import('next').NextConfig} */
const nextConfig = {
  // @prisma/client은 네이티브 바이너리(.so.node)를 사용하므로
  // webpack이 번들링하지 않고 Node.js가 직접 require()하도록 설정합니다.
  // 이렇게 하면 빌드 타임 "collect page data" 단계에서 바이너리 로드를 시도하지 않습니다.
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
  },
}

module.exports = nextConfig
