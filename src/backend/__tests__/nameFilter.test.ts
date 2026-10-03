const { readFileSync, readdirSync } = require('fs') as { readFileSync(path: string, encoding: 'utf8'): string; readdirSync(path: string): string[] };
import { ALLOWED_WORDS, BLOCKED_FRAGMENTS, BLOCKED_WORDS, nameAllowed } from '../nameFilter';

/** The list a SQL function returns, read straight from the migration. */
function sqlList(name: string): string[] {
  const dir = `${__dirname}/../../../supabase/migrations`;
  const file = readdirSync(dir).find(f => f.endsWith('_moderation.sql'))!;
  const sql = readFileSync(`${dir}/${file}`, 'utf8');
  const body = new RegExp(`function public\\.${name}\\(\\)[\\s\\S]*?array\\[([\\s\\S]*?)\\]::text\\[\\]`).exec(sql)![1];
  return Array.from(body.matchAll(/'([^']+)'/g), m => m[1]);
}

describe('the leaderboard name filter', () => {
  it('uses exactly the lists the server enforces', () => {
    expect(BLOCKED_FRAGMENTS).toEqual(sqlList('blocked_fragments'));
    expect(BLOCKED_WORDS).toEqual(sqlList('blocked_words'));
    expect(ALLOWED_WORDS).toEqual(sqlList('allowed_words'));
  });

  it('lets ordinary names and places through', () => {
    for (const name of ['Ana', 'Maris D.', 'Cassandra', 'Dickens', 'Essex', 'Scunthorpe', 'Pulaski', 'București', 'Cluj-Napoca', 'Grape Escape', 'Nazir']) {
      expect([name, nameAllowed(name)]).toEqual([name, true]);
    }
  });

  it('stops slurs and obscene words, however they are spelled', () => {
    for (const name of ['fuck', 'FuCk you', 'f u c k', 'sh1t head', 'b1tch', 'pizdă', 'muie psd', 'Ass', 'big dick', 'p0rnstar', 'tigan', '$lut', 'pula mea']) {
      expect([name, nameAllowed(name)]).toEqual([name, false]);
    }
  });
});
