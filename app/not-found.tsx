import Link from "next/link"
import { getAuthUser } from "@/lib/auth"

export default async function NotFound() {
  const user = await getAuthUser()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        이 페이지를 찾지 못했어요.
      </h1>
      <Link
        href={user ? "/dashboard" : "/"}
        className="mt-6 inline-flex items-center rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-sm font-medium transition-opacity"
      >
        {user ? "대시보드로 가기" : "홈으로 가기"}
      </Link>
    </div>
  )
}
