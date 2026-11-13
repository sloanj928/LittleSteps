'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { api, reloadAt } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, SubmitButton } from '@/ui/fields';
import { forgetInvite, inviteCodeFrom, pendingInvite, rememberInvite } from '@/ui/invite';
import { useTokens } from '@/ui/Providers';
import { useSubmit } from '@/ui/useSubmit';

const noSubscribe = () => () => {};
// The link's code first, then one remembered from before signing in.
const readCode = () => inviteCodeFrom(location.hash) || pendingInvite() || '';

/** Where an invite link lands: sign up or in first if needed, then one tap to join. */
export function JoinInvite({ signedIn }: { signedIn: boolean }) {
  const { ls } = useTokens();
  // Null during the server render, which can't see the fragment.
  const code = useSyncExternalStore(noSubscribe, readCode, () => null);

  useEffect(() => {
    const fromLink = inviteCodeFrom(location.hash);
    if (!fromLink) return;
    rememberInvite(fromLink);
    // Off the address bar and out of history, where a shared screen or the
    // next person on this device would see it. Only once it's safely
    // remembered, or the next render would lose the code altogether.
    if (pendingInvite() === fromLink) history.replaceState(null, '', '/join');
  }, []);

  const join = useSubmit(
    () => api('/api/invites/join', { method: 'POST', body: { code } }),
    () => {
      forgetInvite();
      reloadAt('/');
    },
  );
  // A code that failed or was already used by this person won't work on a retry.
  const spent = join.code === 'INVALID_CODE' || join.code === 'ALREADY_MEMBER';
  useEffect(() => {
    if (spent) forgetInvite();
  }, [spent]);

  if (code === null) {
    return (
      <AuthPage title="Join a household">
        <CircularProgress aria-label="Loading" sx={{ alignSelf: 'center' }} />
      </AuthPage>
    );
  }
  if (!code) {
    return (
      <AuthPage title="Join a household" intro="This link is missing its invite code. Ask for a new link, or enter the code under More, Household.">
        <Button variant="contained" size="large" component={Link} href="/">
          Go to Little Steps
        </Button>
      </AuthPage>
    );
  }
  if (!signedIn) {
    return (
      <AuthPage title="You're invited" intro="Someone invited you to their family's Little Steps. Create an account or sign in, and you'll come straight back here to join.">
        <Button variant="contained" size="large" component={Link} href="/signup">
          Create an account
        </Button>
        <Button size="large" component={Link} href="/signin">
          I already have an account
        </Button>
      </AuthPage>
    );
  }
  return (
    <AuthPage title="Join a household" intro="You'll join as view-only. An owner can change that afterwards." onSubmit={spent ? undefined : join.run}>
      <FormError message={join.error} />
      <Box aria-label={`Code: ${code.split('').join(' ')}`} sx={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.12em', textAlign: 'center', py: 2, borderRadius: 4, bgcolor: ls.surfaceContainerHigh, fontVariantNumeric: 'tabular-nums' }}>
        {code.slice(0, 4)} {code.slice(4)}
      </Box>
      {spent ? (
        <Button variant="contained" size="large" onClick={() => reloadAt('/')}>
          Go to Little Steps
        </Button>
      ) : (
        <>
          <SubmitButton busy={join.busy}>Join</SubmitButton>
          <Button
            size="large"
            onClick={() => {
              forgetInvite();
              reloadAt('/');
            }}
          >
            Not now
          </Button>
        </>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        Invite codes work once and last 48 hours.
      </Typography>
    </AuthPage>
  );
}
