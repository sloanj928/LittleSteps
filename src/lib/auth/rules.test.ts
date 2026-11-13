import { describe, expect, it } from 'vitest';
import { isCommonPassword } from './commonPasswords';
import { normalizeUsername, passwordProblem, pinProblem, usernameProblem } from './rules';

describe('usernames', () => {
  it('compares names case-insensitively and folds compatibility forms', () => {
    expect(normalizeUsername('  Mama.Bear ')).toBe('mama.bear');
    // Full-width letters fold to ASCII, so "ｍａｍａ" can't sit beside "mama".
    expect(normalizeUsername('ｍａｍａ')).toBe('mama');
  });

  it('accepts ordinary names', () => {
    for (const name of ['mama', 'papa_bear', 'gran.2', 'a1b']) expect(usernameProblem(name)).toBeNull();
  });

  it('rejects lookalike letters, reserved names and bad shapes', () => {
    expect(usernameProblem('mаma')).not.toBeNull(); // Cyrillic "а"
    expect(usernameProblem('Admin')).not.toBeNull();
    expect(usernameProblem('support')).not.toBeNull();
    expect(usernameProblem('ab')).not.toBeNull();
    expect(usernameProblem('a'.repeat(25))).not.toBeNull();
    expect(usernameProblem('has space')).not.toBeNull();
    expect(usernameProblem('.dot')).not.toBeNull();
    expect(usernameProblem('do..t')).not.toBeNull();
  });
});

describe('passwords', () => {
  const check = (p: string) => passwordProblem(p, 'mama', isCommonPassword);

  it('accepts a phrase', () => {
    expect(check('correct horse battery')).toBeNull();
  });

  it('rejects short, repeated, common and username-based passwords', () => {
    expect(check('short1234')).not.toBeNull();
    expect(check('aaaaaaaaaaaa')).not.toBeNull();
    expect(check('password123')).not.toBeNull();
    expect(check('Password123!')).not.toBeNull();
    expect(check('qwertyuiop')).not.toBeNull();
    expect(check('mama-is-the-best')).not.toBeNull();
  });
});

describe('PINs', () => {
  it('accepts an ordinary PIN', () => {
    expect(pinProblem('274916')).toBeNull();
  });

  it('rejects the PINs people guess first', () => {
    for (const pin of ['111111', '123456', '654321', '121212', '123123', '112233', '12345', '1234567', '12a456']) {
      expect(pinProblem(pin), pin).not.toBeNull();
    }
  });
});
