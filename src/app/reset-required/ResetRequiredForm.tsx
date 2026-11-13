'use client';

import { useState } from 'react';
import { PASSWORD_MIN, passwordProblem, pinProblem } from '@/lib/auth/rules';
import { api, reloadAt } from '@/ui/api';
import { AuthPage } from '@/ui/AuthPage';
import { FormError, PasswordInput, PinInput, SubmitButton } from '@/ui/fields';
import { homeAfterSignIn } from '@/ui/invite';
import { useSubmit } from '@/ui/useSubmit';

/** The last step of admin recovery: the temporary password only reaches this screen. */
export function ResetRequiredForm({ username }: { username: string }) {
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [checked, setChecked] = useState(false);
  const problems = {
    newPassword: passwordProblem(newPassword, username),
    newPin: pinProblem(newPin),
    pinAgain: newPin === pinAgain ? null : "The two PINs don't match.",
  };
  const form = useSubmit(
    () => api('/api/auth/complete-reset', { method: 'POST', body: { newPassword, newPin } }),
    () => reloadAt(homeAfterSignIn()),
  );
  const submit = () => {
    setChecked(true);
    if (Object.values(problems).every((p) => !p)) void form.run();
  };
  const problem = (field: keyof typeof problems) => form.fields[field] ?? (checked ? (problems[field] ?? undefined) : undefined);
  return (
    <AuthPage title={`Welcome back, ${username}`} intro="You signed in with a temporary password. Choose a new password and a new PIN to finish. Nobody else will know either." onSubmit={submit}>
      <FormError message={form.error} />
      <PasswordInput isNew label="New password" value={newPassword} onChange={setNewPassword} problem={problem('newPassword')} helperText={`At least ${PASSWORD_MIN} characters.`} />
      <PinInput label="New 6-digit PIN" value={newPin} onChange={setNewPin} problem={problem('newPin')} />
      <PinInput label="PIN again" value={pinAgain} onChange={setPinAgain} problem={problem('pinAgain')} />
      <SubmitButton busy={form.busy}>Save and continue</SubmitButton>
    </AuthPage>
  );
}
