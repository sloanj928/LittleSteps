import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { babies, entries, measurements } from '@/db/schema';
import { requireMember } from '@/lib/server/access';
import { ApiError, requireUser, route } from '@/lib/server/api';

// A cell starting with = + - or @ runs as a formula when the CSV is opened
// in a spreadsheet. A leading apostrophe makes it plain text.
function cell(value: unknown): string {
  if (value == null) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value !== 'number') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

function download(body: string, type: string, filename: string): Response {
  return new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'Content-Disposition': `attachment; filename="${filename}"` } });
}

// The household's own data, for its owners to keep: one JSON file with
// everything, or a spreadsheet-friendly CSV each for entries and measurements.
// Deleted rows are left out.
export const GET = route<{ id: string }>(async (req, { id }) => {
  const { user } = await requireUser(req);
  const { household } = await requireMember(user.id, id, 'owner');
  const format = new URL(req.url).searchParams.get('format') ?? 'json';

  const d = await db();
  const kids = await d.select().from(babies).where(eq(babies.householdId, id)).orderBy(asc(babies.birthDate));
  const ids = kids.map((b) => b.id);
  const entryRows = ids.length ? (await d.select().from(entries).where(inArray(entries.babyId, ids)).orderBy(asc(entries.date))).filter((e) => !e.deletedAt) : [];
  const measurementRows = ids.length ? (await d.select().from(measurements).where(inArray(measurements.babyId, ids)).orderBy(asc(measurements.date))).filter((m) => !m.deletedAt) : [];
  const nameOf = new Map(kids.map((b) => [b.id, b.name]));
  const day = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    const body = {
      exportedAt: new Date().toISOString(),
      household: { name: household.name },
      babies: kids.map((b) => ({
        name: b.name,
        birthDate: b.birthDate,
        sex: b.sex,
        dueDate: b.dueDate,
        entries: entryRows.filter((e) => e.babyId === b.id).map(({ kind, title, date, datePrecision, reaction, allergyFlag, foodGroup, note, createdAt }) => ({ kind, title, date, datePrecision, reaction, allergyFlag, foodGroup, note, createdAt })),
        measurements: measurementRows.filter((m) => m.babyId === b.id).map(({ date, weightOz, lengthIn, headIn, note }) => ({ date, weightOz, lengthIn, headIn, note })),
      })),
    };
    return download(JSON.stringify(body, null, 2), 'application/json', `little-steps-${day}.json`);
  }
  if (format === 'entries.csv') {
    const rows = entryRows.map((e) => [nameOf.get(e.babyId), e.kind, e.title, e.date, e.datePrecision, e.reaction, e.kind === 'food' ? (e.allergyFlag ? 'yes' : 'no') : '', e.foodGroup, e.note]);
    return download(csv(['baby', 'kind', 'title', 'date', 'date_precision', 'reaction', 'possible_allergy', 'food_group', 'note'], rows), 'text/csv', `little-steps-entries-${day}.csv`);
  }
  if (format === 'measurements.csv') {
    const rows = measurementRows.map((m) => [nameOf.get(m.babyId), m.date, m.weightOz, m.lengthIn, m.headIn, m.note]);
    return download(csv(['baby', 'date', 'weight_oz', 'length_in', 'head_in', 'note'], rows), 'text/csv', `little-steps-measurements-${day}.csv`);
  }
  throw new ApiError(400, 'BAD_FORMAT', 'Choose json, entries.csv or measurements.csv.');
});
