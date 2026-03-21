/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma가 빌드 타임에 DATABASE_URL 없이 모듈 로드 시 실패하지 않도록
  // 실제 DB 연결은 런타임에만 발생하므로 더미값으로 충분합니다.
  env: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    DIRECT_URL: process.env.DIRECT_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
}

module.exports = nextConfig
