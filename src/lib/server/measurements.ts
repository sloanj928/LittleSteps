import 'server-only';
import { z } from 'zod';
import { isoDate } from './entries';

// Bounds only rule out numbers that cannot be a child (a negative weight, a
// 40-foot length). Anything merely unusual is the form's job to
// double-check and the parent's to confirm; the server never refuses it.
const value = (max: number) => z.number().positive('Enter a number above zero.').max(max, 'That number is too large to be right.').nullish();

export const MeasurementFields = z
  .object({
    date: isoDate,
    weightOz: value(4800),
    lengthIn: value(100),
    headIn: value(40),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((m) => m.weightOz != null || m.lengthIn != null || m.headIn != null, { path: ['weightOz'], message: 'Enter at least one measurement.' });

export function measurementColumns(input: z.infer<typeof MeasurementFields>) {
  return { date: input.date, weightOz: input.weightOz ?? null, lengthIn: input.lengthIn ?? null, headIn: input.headIn ?? null, note: input.note || null };
}
