'use client';

import { useState } from 'react';
import { ApiFailure, fieldsOf, messageOf } from './api';

/**
 * Runs a form's save. On failure the form keeps everything that was typed
 * and shows why: field problems under their fields, anything else as one
 * message. `failure` is the raw error, for forms that react to a code.
 */
export function useSubmit<T>(save: () => Promise<T>, onSaved?: (result: T) => void) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const fields = fieldsOf(failure);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const result = await save();
      onSaved?.(result);
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    run,
    fields,
    code: failure instanceof ApiFailure ? failure.code : null,
    details: failure instanceof ApiFailure ? failure.details : {},
    // A field problem is shown under its field; repeating it on top is noise.
    error: failure && Object.keys(fields).length === 0 ? messageOf(failure) : null,
    clear: () => setFailure(null),
  };
}
