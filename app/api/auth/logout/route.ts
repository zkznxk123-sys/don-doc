export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// Clerk handles sign-out on the client via <SignOutButton /> or useClerk().signOut()
// This route remains for backward compatibility but just redirects
export async function POST() {
  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirectTo = url.searchParams.get('redirect') || '/sign-in'
  return NextResponse.redirect(new URL(redirectTo, req.url))
}
