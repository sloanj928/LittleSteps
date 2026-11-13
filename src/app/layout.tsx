import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import type { ReactNode } from 'react';
import { PALETTE_COOKIE, PALETTE_IDS, type PaletteId } from '@/lib/types';
import { Providers } from '@/ui/Providers';
import { ServiceWorker } from '@/ui/ServiceWorker';
import './globals.css';

// Downloaded at build time and served from our own origin: no font CDN.
const nunito = Nunito({ variable: '--font-nunito', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Little Steps', template: '%s · Little Steps' },
  description: "A private place for your baby's firsts, foods, words and growth.",
  applicationName: 'Little Steps',
  appleWebApp: { capable: true, title: 'Little Steps', statusBarStyle: 'default' },
  // A private app: nothing here belongs in a search index.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffdf8' },
    { media: '(prefers-color-scheme: dark)', color: '#11150f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the request makes every page render per request, which the
  // per-request CSP nonce (src/proxy.ts) requires anyway.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const stored = (await cookies()).get(PALETTE_COOKIE)?.value as PaletteId | undefined;
  const palette = stored && PALETTE_IDS.includes(stored) ? stored : 'sage';
  return (
    <html lang="en" className={nunito.variable}>
      <body>
        <AppRouterCacheProvider options={{ nonce }}>
          <Providers palette={palette}>{children}</Providers>
        </AppRouterCacheProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
