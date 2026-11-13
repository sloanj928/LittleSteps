'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { api, reloadAt } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, PasswordInput, SubmitButton, TextInput } from '@/ui/fields';
import { useSubmit } from '@/ui/useSubmit';

export default function SignInPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const form = useSubmit(
    () => api<{ mustReset: boolean }>('/api/auth/signin', { method: 'POST', body: { username, password } }),
    (res) => reloadAt(res.mustReset ? '/reset-required' : '/'),
  );
  return (
    <AuthPage
      title="Little Steps"
      intro="Sign in to your family's space."
      onSubmit={form.run}
      footer={
        <>
          <Button component={Link} href="/signup">
            Create an account
          </Button>
          <Button component={Link} href="/forgot">
            Forgot your password?
          </Button>
          <Button component={Link} href="/support">
            Contact support
          </Button>
        </>
      }
    >
      <FormError message={form.error} />
      <TextInput label="Username" value={username} onChange={setUsername} autoComplete="username" autoCapitalize="none" spellCheck={false} problem={form.fields.username} />
      <PasswordInput label="Password" value={password} onChange={setPassword} problem={form.fields.password} />
      <SubmitButton busy={form.busy}>Sign in</SubmitButton>
    </AuthPage>
  );
}
