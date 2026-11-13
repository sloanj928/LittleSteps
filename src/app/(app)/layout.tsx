import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { pageSession } from '@/lib/server/pageSession';
import { AppShell } from '@/ui/app/AppShell';

// Every signed-in screen sits under this layout, so the session is checked
// on the server before any of the app is sent. The data itself is protected
// again, per request, by the API routes.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const found = await pageSession();
  if (!found) redirect('/signin');
  if (found.user.mustReset) redirect('/reset-required');
  return <AppShell>{children}</AppShell>;
}
