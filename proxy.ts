import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function proxy(request: NextRequest) {
  // Geo-restriction: Japan only
  const country = request.headers.get('x-vercel-ip-country');
  if (country && country !== 'JP') {
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'This service is only available in Japan' },
        { status: 403 }
      );
    }
    return new NextResponse(
      '<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666"><div style="text-align:center"><h1>やすめし</h1><p>このサービスは日本国内でのみご利用いただけます。</p><p style="font-size:14px;color:#999">This service is only available in Japan.</p></div></div></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;

  if (entry.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png).*)'],
};
