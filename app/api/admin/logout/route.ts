import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  // 303 forces the browser to GET the login page after the POST.
  return NextResponse.redirect(new URL('/admin/login', req.url), 303);
}
