import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkPassword, createToken, SESSION_COOKIE, SESSION_OPTIONS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? '');
  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(), SESSION_OPTIONS);
  return NextResponse.json({ ok: true });
}
