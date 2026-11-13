'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useApp } from '@/ui/app/AppShell';
import { JoinOrCreate } from '@/ui/app/JoinOrCreate';
import { Logo } from '@/ui/Logo';

/** First sign-in: join a family's household with a code, or start one. */
export default function WelcomePage() {
  const { me } = useApp();
  const router = useRouter();
  return (
    <Stack component="main" spacing={2.5} sx={{ maxWidth: 520, mx: 'auto', px: 2, py: 4, pt: 'calc(32px + env(safe-area-inset-top))' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
        <Logo size={72} />
        <Typography variant="h4" component="h1">
          Welcome, {me.user.username}
        </Typography>
        <Typography color="text.secondary">If someone invited you, enter their code. Otherwise, start a household for your family.</Typography>
      </Stack>
      <JoinOrCreate onDone={() => router.replace('/')} />
    </Stack>
  );
}
