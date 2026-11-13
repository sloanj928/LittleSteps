'use client';

import { useEffect } from 'react';

/** Registers the service worker that makes the app installable and gives it an offline page. */
export function ServiceWorker() {
  useEffect(() => {
    // Not in development: a cached shell there serves stale code.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a nicety; the app works without it.
    });
  }, []);
  return null;
}
