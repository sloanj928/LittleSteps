import { NextResponse, type NextRequest } from 'next/server';

// A fresh nonce per page view. Only scripts carrying it may run, so text a
// family types into the app can never execute as code.
//
// Styles keep 'unsafe-inline': MUI's runtime styles and the themes' inline
// SVG `style` attributes need it, and a style can't read or send data the
// way a script can. Nothing loads from another origin: no trackers, no CDNs,
// fonts self-hosted.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Not on plain-http localhost: Safari would upgrade its requests to an
    // https port nothing is listening on.
    ...(request.nextUrl.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only. API responses are JSON and static files carry no scripts.
    { source: '/((?!api|_next/static|_next/image|icons|favicon.ico|sw.js|manifest.webmanifest).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }] },
  ],
};
