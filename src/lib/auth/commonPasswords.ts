import 'server-only';

// The most-used passwords of at least 10 characters (shorter ones already fail
// the length rule), from public breach-frequency lists, lowercased. A
// password is also rejected when it is one of these with digits or "!" on the
// end ("password123!"), which is how people usually stretch one to length.
const LIST = `
1234567890 0987654321 1q2w3e4r5t qwertyuiop 1qaz2wsx3edc password12 password123 password1234 passw0rd12
iloveyou12 qwerty1234 qwerty12345 1234qwerty 123qweasd zxcvbnm123 asdfghjkl1 asdfghjkl qazwsxedc123
abcdefghij abcd123456 abc1234567 123456789a a123456789 1234567890a q1w2e3r4t5 trustno123 sunshine12
football12 baseball12 basketball princess12 superman12 batman1234 starwars12 letmein123 welcome123
welcome1234 monkey1234 dragon1234 master1234 shadow1234 michael123 jennifer12 jordan2323 hunter1234
whatever12 freedom123 computer12 internet12 charlie123 changeme12 changeme123 secret1234 administrator
babygirl12 babyboy123 mybaby1234 iloveyou123 lovelove12 loveyou123 mommy12345 daddy12345 family1234
newborn123 littlesteps littlesteps1 littlesteps123 babysteps1 babysteps12 password password1
`;

const COMMON = new Set(LIST.split(/\s+/).filter(Boolean));
const BASES = ['password', 'passw0rd', 'qwerty', 'iloveyou', 'welcome', 'letmein', 'baby', 'babygirl', 'babyboy', 'littlesteps', 'princess', 'sunshine', 'football', 'monkey', 'dragon', 'abc', 'admin'];

export function isCommonPassword(lower: string): boolean {
  if (COMMON.has(lower)) return true;
  const stem = lower.replace(/[\d!@#.]+$/, '');
  return stem.length < lower.length && (BASES.includes(stem) || COMMON.has(stem));
}
