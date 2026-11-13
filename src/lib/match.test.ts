import { describe, expect, it } from 'vitest';
import { matchScore, nameKey, rankMatches } from './match';

describe('nameKey', () => {
  it('treats case, accents, punctuation, spacing and a plural as the same name', () => {
    expect(nameKey('Bananas')).toBe(nameKey('banana'));
    expect(nameKey('uh-oh')).toBe(nameKey('Uh oh'));
    expect(nameKey('Crème brûlée')).toBe(nameKey('creme brulee'));
    expect(nameKey(' Dada! ')).toBe(nameKey('dada'));
  });

  it('keeps different words apart, including short words ending in s', () => {
    expect(nameKey('ball')).not.toBe(nameKey('bell'));
    expect(nameKey('yes')).not.toBe(nameKey('ye'));
  });
});

describe('matchScore', () => {
  it('finds close spellings, including a half-typed one', () => {
    expect(matchScore('brocolli', 'Broccoli')).not.toBeNull();
    expect(matchScore('bananna', 'Banana')).not.toBeNull();
    expect(matchScore('blubery', 'Blueberries')).not.toBeNull();
    expect(matchScore('swet pot', 'Sweet potato')).not.toBeNull();
  });

  it('ranks exact over starts-with over contains over a misspelling', () => {
    const scores = ['pea', 'peach', 'chickpeas', 'pear'].map((c) => matchScore('pea', c));
    expect(scores[0]).toBe(0);
    expect(scores[1]).toBeLessThan(scores[2]!);
  });

  it('does not stretch a short query into unrelated names', () => {
    expect(matchScore('ba', 'Ma')).toBeNull();
    expect(matchScore('dog', 'Banana')).toBeNull();
  });
});

describe('rankMatches', () => {
  it('drops non-matches and puts the best first', () => {
    expect(rankMatches('carot', ['Pear', 'Carrot', 'Carrot cake'], (s) => s)).toEqual(['Carrot', 'Carrot cake']);
  });
});
