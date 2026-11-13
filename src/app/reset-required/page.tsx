import { redirect } from 'next/navigation';
import { pageSession } from '@/lib/server/pageSession';
import { ResetRequiredForm } from './ResetRequiredForm';

export const metadata = { title: 'Choose a new password' };

export default async function ResetRequiredPage() {
  const found = await pageSession();
  if (!found) redirect('/signin');
  if (!found.user.mustReset) redirect('/');
  return <ResetRequiredForm username={found.user.usernameDisplay} />;
}
