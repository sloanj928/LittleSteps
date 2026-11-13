import FirstIcon from '@mui/icons-material/AutoAwesomeOutlined';
import WordIcon from '@mui/icons-material/ChatBubbleOutlined';
import NoteIcon from '@mui/icons-material/EditNoteOutlined';
import FoodIcon from '@mui/icons-material/RestaurantOutlined';
import LovedIcon from '@mui/icons-material/SentimentVerySatisfiedOutlined';
import NeutralIcon from '@mui/icons-material/SentimentNeutralOutlined';
import DislikedIcon from '@mui/icons-material/SentimentDissatisfiedOutlined';
import GrowthIcon from '@mui/icons-material/StraightenOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import type { EntryKind, Reaction } from '@/db/schema';
import { ageOrigin, formatAge } from '@/lib/dates';
import type { Baby, Entry } from '@/lib/types';

export const KINDS: Record<EntryKind | 'growth', { label: string; plural: string; Icon: SvgIconComponent }> = {
  first: { label: 'First', plural: 'Firsts', Icon: FirstIcon },
  food: { label: 'Food', plural: 'Foods', Icon: FoodIcon },
  word: { label: 'Word', plural: 'Words', Icon: WordIcon },
  note: { label: 'Note', plural: 'Notes', Icon: NoteIcon },
  growth: { label: 'Measurement', plural: 'Growth', Icon: GrowthIcon },
};

// A face and a word, always together: the face alone would lean on shape
// recognition, and neither leans on colour.
export const REACTIONS: Record<Reaction, { label: string; Icon: SvgIconComponent }> = {
  loved: { label: 'Loved it', Icon: LovedIcon },
  neutral: { label: 'It was okay', Icon: NeutralIcon },
  disliked: { label: 'Not a fan', Icon: DislikedIcon },
};

/** "7 months, 2 days", or with corrected age "5 months, 1 day (corrected)". Null when the date isn't known. */
export function ageAt(baby: Baby, date: string | null, precision: Entry['datePrecision'] = 'day'): string | null {
  if (!date) return null;
  const origin = ageOrigin(baby, date);
  const age = formatAge(origin, date, precision);
  return age && origin !== baby.birthDate ? `${age} (corrected)` : age;
}

export function authorOf(people: Record<string, string>, userId: string): string {
  return people[userId] ?? 'a former member';
}
