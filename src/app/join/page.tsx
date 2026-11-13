import { redirect } from 'next/navigation';
import { pageSession } from '@/lib/server/pageSession';
import { JoinInvite } from './JoinInvite';

export const metadata = { title: 'Join a household' };

// Outside the signed-in layout on purpose: someone opening an invite link
// usually has no account yet, and the layout would send them to sign-in
// before the page could read the code from the link.
export default async function JoinPage() {
  const found = await pageSession();
  if (found?.user.mustReset) redirect('/reset-required');
  return <JoinInvite signedIn={Boolean(found)} />;
}
