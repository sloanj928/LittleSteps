'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { PASSWORD_MIN, passwordProblem, pinProblem, usernameProblem } from '@/lib/auth/rules';
import { api, reloadAt } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, PasswordInput, PinInput, SubmitButton, TextInput } from '@/ui/fields';
import { useSubmit } from '@/ui/useSubmit';

export default function SignUpPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [checked, setChecked] = useState(false);

  // The same rules the server enforces, run here first for instant feedback.
  const problems = {
    username: usernameProblem(username),
    password: passwordProblem(password, username),
    pin: pinProblem(pin),
    pinAgain: pin === pinAgain ? null : "The two PINs don't match.",
  };
  const form = useSubmit(
    () => api('/api/auth/signup', { method: 'POST', body: { username, password, pin } }),
    () => reloadAt('/'),
  );
  const submit = () => {
    setChecked(true);
    if (Object.values(problems).every((p) => !p)) void form.run();
  };
  const problem = (field: keyof typeof problems) => form.fields[field] ?? (checked ? (problems[field] ?? undefined) : undefined);

  return (
    <AuthPage
      title="Create your account"
      intro="No email needed. A username, a password and a PIN."
      onSubmit={submit}
      footer={
        <Button component={Link} href="/signin">
          I already have an account
        </Button>
      }
    >
      <FormError message={form.error} />
      <TextInput label="Username" value={username} onChange={setUsername} autoComplete="username" autoCapitalize="none" spellCheck={false} problem={problem('username')} helperText="3 to 24 letters, numbers, underscores or periods." />
      <PasswordInput isNew label="Password" value={password} onChange={setPassword} problem={problem('password')} helperText={`At least ${PASSWORD_MIN} characters. A short phrase works well.`} />
      <PinInput label="6-digit PIN" value={pin} onChange={setPin} problem={problem('pin')} helperText="Your PIN is how you reset a forgotten password." />
      <PinInput label="PIN again" value={pinAgain} onChange={setPinAgain} problem={problem('pinAgain')} />
      <Alert severity="info">
        There is no email on your account, so we can&apos;t send a reset link. Keep your PIN somewhere safe: it is the only way to reset your password yourself.
      </Alert>
      <SubmitButton busy={form.busy}>Create account</SubmitButton>
    </AuthPage>
  );
}
