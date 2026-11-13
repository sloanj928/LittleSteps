import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Little Steps',
    short_name: 'Little Steps',
    description: "A private place for your baby's firsts, foods, words and growth.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // The logo's sage behind the splash icon; the cream page colour for the bar.
    background_color: '#8cbfa6',
    theme_color: '#fffdf8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
