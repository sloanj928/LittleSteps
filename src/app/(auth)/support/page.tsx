'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, SubmitButton, TextInput } from '@/ui/fields';
import { useSubmit } from '@/ui/useSubmit';

export default function SupportPage() {
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const form = useSubmit(
    () => api('/api/support', { method: 'POST', body: { username, note } }),
    () => setSent(true),
  );
  const back = (
    <Button component={Link} href="/signin">
      Back to sign in
    </Button>
  );
  if (sent) {
    return (
      <AuthPage title="Request sent" footer={back}>
        <Alert severity="success">
          Thank you. Whoever looks after this Little Steps site will see your request. Because your account has no email, they will reach you the way your family normally would: in person or by phone.
        </Alert>
      </AuthPage>
    );
  }
  return (
    <AuthPage title="Contact support" intro="Locked out, or lost both your password and PIN? Tell us and an admin can help you back in." onSubmit={form.run} footer={back}>
      <FormError message={form.error} />
      <TextInput label="Your username" value={username} onChange={setUsername} autoCapitalize="none" spellCheck={false} problem={form.fields.username} />
      <TextInput label="What happened?" value={note} onChange={setNote} multiline minRows={3} problem={form.fields.note} helperText="Please don't include a password or PIN." slotProps={{ htmlInput: { maxLength: 1000 } }} />
      <SubmitButton busy={form.busy}>Send request</SubmitButton>
    </AuthPage>
  );
}
