import 'server-only';
import { z } from 'zod';
import { isIsoDate } from '@/lib/dates';
import { isoDate } from './entries';

export const BabyFields = z
  .object({
    name: z.string().trim().min(1, "Add your baby's name.").max(60),
    birthDate: isoDate,
    // Optional on purpose: it is only needed for growth percentiles, and the
    // growth screen asks for it there, with the reason.
    sex: z.enum(['male', 'female']).nullish(),
    dueDate: z.string().refine(isIsoDate, 'Pick a valid date.').nullish(),
    correctedAge: z.boolean().optional(),
  })
  .refine((b) => !b.correctedAge || Boolean(b.dueDate), { path: ['dueDate'], message: 'Corrected age needs the due date.' })
  .refine((b) => !b.correctedAge || !b.dueDate || b.dueDate > b.birthDate, { path: ['dueDate'], message: 'For corrected age, the due date should be after the birth date.' });
