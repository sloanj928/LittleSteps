import { describe, expect, it } from 'vitest';
import { nameKey } from './match';
import { WORD_SUGGESTIONS } from './words';

describe('word suggestions', () => {
  it('reach well past first words', () => {
    for (const w of ['Tiger', 'Garbage', 'School', 'Excavator', 'Yesterday', 'Tigre', 'Śmieci']) expect(WORD_SUGGESTIONS).toContain(w);
  });

  it('offer each word once, by the duplicate check’s own rule', () => {
    const keys = WORD_SUGGESTIONS.map(nameKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(WORD_SUGGESTIONS).toContain('Mama');
    expect(WORD_SUGGESTIONS).not.toContain('Mamá');
  });

  it('leave out what a word count does not count: recited numbers and sentence-like phrases', () => {
    for (const w of ['Three', 'I love you', 'My turn', 'Te quiero', 'Kocham cię']) expect(WORD_SUGGESTIONS).not.toContain(w);
    for (const w of ['Moo', 'Thank you', 'All gone', 'Night-night', 'Se acabó', 'Nie ma']) expect(WORD_SUGGESTIONS).toContain(w);
  });
});
