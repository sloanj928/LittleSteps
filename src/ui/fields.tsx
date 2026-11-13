'use client';

import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import Alert from '@mui/material/Alert';
import Button, { type ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useState } from 'react';

type FieldProps = Omit<TextFieldProps, 'onChange' | 'value' | 'error'> & {
  value: string;
  onChange: (value: string) => void;
  /** A problem to show under the field, replacing the helper text. */
  problem?: string;
};

export function TextInput({ value, onChange, problem, helperText, ...rest }: FieldProps) {
  return <TextField {...rest} value={value} onChange={(e) => onChange(e.target.value)} error={Boolean(problem)} helperText={problem ?? helperText} />;
}

/** A password box with a show/hide toggle, so nobody needs a "confirm password" field. */
export function PasswordInput({ isNew, ...rest }: FieldProps & { isNew?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <TextInput
      {...rest}
      type={shown ? 'text' : 'password'}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown((s) => !s)} edge="end">
                {shown ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export function PinInput({ onChange, ...rest }: FieldProps) {
  return (
    <TextInput
      {...rest}
      // Digits only, whatever is typed or pasted.
      onChange={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      type="password"
      autoComplete="off"
      slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 } }}
    />
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert severity="error" role="alert">
      {message}
    </Alert>
  );
}

export function SubmitButton({ busy, children, ...rest }: ButtonProps & { busy?: boolean }) {
  return (
    <Button type="submit" variant="contained" size="large" disabled={busy} {...rest}>
      {busy ? <CircularProgress size={24} color="inherit" aria-label="Working" /> : children}
    </Button>
  );
}
