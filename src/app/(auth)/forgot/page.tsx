'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { PASSWORD_MIN } from '@/lib/auth/rules';
import { api, reloadAt } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, PasswordInput, PinInput, SubmitButton, TextInput } from '@/ui/fields';
import { homeAfterSignIn } from '@/ui/invite';
import { useSubmit } from '@/ui/useSubmit';

export default function ForgotPage() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const form = useSubmit(
    () => api('/api/auth/reset', { method: 'POST', body: { username, pin, newPassword } }),
    () => reloadAt(homeAfterSignIn()),
  );
  return (
    <AuthPage
      title="Reset your password"
      intro="Enter your username and the 6-digit PIN you chose when you signed up."
      onSubmit={form.run}
      footer={
        <>
          <Button component={Link} href="/signin">
            Back to sign in
          </Button>
          <Button component={Link} href="/support">
            I forgot my PIN too
          </Button>
        </>
      }
    >
      <FormError message={form.error} />
      <TextInput label="Username" value={username} onChange={setUsername} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      <PinInput label="6-digit PIN" value={pin} onChange={setPin} />
      <PasswordInput isNew label="New password" value={newPassword} onChange={setNewPassword} problem={form.fields.newPassword} helperText={`At least ${PASSWORD_MIN} characters.`} />
      <SubmitButton busy={form.busy}>Reset password</SubmitButton>
    </AuthPage>
  );
}
