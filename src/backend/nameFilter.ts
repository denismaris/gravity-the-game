/**
 * The leaderboard name filter, as the app runs it: the same lists and the
 * same folding as `name_ok` in supabase/migrations/*_moderation.sql, so a
 * name the server would refuse is caught here first, with a message,
 * instead of a save that silently fails. The server's check is the one
 * that counts; a test keeps these lists identical to it.
 */

export const BLOCKED_FRAGMENTS: ReadonlyArray<string> = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'nigg', 'niga', 'fagot', 'faggot', 'whore', 'slut',
  'rapist', 'hitler', 'porn', 'pussy', 'asshole', 'bastard', 'retard', 'molest', 'pedo', 'kkk',
  'pizda', 'futut', 'futui', 'tarfa', 'cacat', 'poponar', 'bulangiu', 'labagiu', 'jidan', 'muist', 'pulamea',
];

export const BLOCKED_WORDS: ReadonlyArray<string> = [
  'ass', 'cum', 'sex', 'tit', 'tits', 'cock', 'dick', 'fag', 'rape', 'anal', 'nazi', 'jizz',
  'pula', 'muie', 'curva', 'coaie', 'futu', 'sugi', 'tigan', 'tigani',
];

export const ALLOWED_WORDS: ReadonlyArray<string> = ['scunthorpe', 'penistone', 'clitheroe'];

const FROM = 'ăâîșşțţ013457@$!|';
const TO = 'aaissttoieastasii';

function fold(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    const i = FROM.indexOf(ch);
    out += i >= 0 ? TO[i] : ch;
  }
  return out.replace(new RegExp(`(${ALLOWED_WORDS.join('|')})`, 'g'), ' ');
}

/** Whether a name or city may be shown to other players. */
export function nameAllowed(text: string): boolean {
  const folded = fold(text);
  const squeezed = folded.replace(/[^a-z]/g, '');
  if (BLOCKED_FRAGMENTS.some(w => squeezed.includes(w))) return false;
  return !BLOCKED_WORDS.some(w => new RegExp(`(^|[^a-z])${w}($|[^a-z])`).test(folded));
}
