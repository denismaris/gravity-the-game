// Moderation: the name filter, reports, and a reported name hidden from
// the boards. Same harness as db.test.mjs.
//
//     npm run test:db

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(here, '..', 'migrations');
const STUB = readFileSync(join(here, 'supabase-stub.sql'), 'utf8');

const ids = Array.from({ length: 5 }, (_v, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
const [ana, bogdan, cara, dan, emma] = ids;
const today = new Date().toISOString().slice(0, 10);

async function fresh() {
  const db = new PGlite();
  await db.exec(STUB);
  for (const file of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  await db.exec(`insert into auth.users (id) values ${ids.map(id => `('${id}')`).join(', ')}`);
  return db;
}

async function as(db, id, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const ok = async (db, name) => (await db.query('select public.name_ok($1) as ok', [name])).rows[0].ok;

test('the filter: ordinary names and places pass', async () => {
  const db = await fresh();
  for (const name of ['Ana', 'Maris D.', 'Cassandra', 'Dickens', 'Essex', 'Scunthorpe', 'Pulaski', 'București', 'Cluj-Napoca', 'Grape Escape', 'Tită', 'Nazir']) {
    assert.equal(await ok(db, name), true, name);
  }
});

test('the filter: slurs and obscene words do not, however they are spelled', async () => {
  const db = await fresh();
  for (const name of ['fuck', 'FuCk you', 'f u c k', 'sh1t head', 'b1tch', 'pizdă', 'muie psd', 'Ass', 'big dick', 'p0rnstar', 'tigan', '$lut', 'pula mea']) {
    assert.equal(await ok(db, name), false, name);
  }
});

test('a blocked name or city cannot be saved', async () => {
  const db = await fresh();
  await assert.rejects(as(db, ana, "insert into profiles (id, display_name) values ($1, 'fuck off')", [ana]));
  await assert.rejects(as(db, ana, "insert into profiles (id, display_name, country, city) values ($1, 'Ana', 'RO', 'sh1tville')", [ana]));
  await as(db, ana, "insert into profiles (id, display_name, country, city) values ($1, 'Ana', 'RO', 'Bucharest')", [ana]);
  await assert.rejects(as(db, ana, "update profiles set display_name = 'b1tch' where id = $1", [ana]));
});

test('reports: nobody can read them, and you cannot report yourself', async () => {
  const db = await fresh();
  await as(db, ana, "insert into profiles (id, display_name) values ($1, 'Ana')", [ana]);
  await as(db, bogdan, 'select report_player($1)', [ana]);
  await as(db, ana, 'select report_player($1)', [ana]);
  assert.deepEqual((await as(db, bogdan, 'select * from reports')).rows, []);
  assert.equal(Number((await db.query('select count(*) as n from reports')).rows[0].n), 1);
});

test('three reports hide a name from the boards, until it changes', async () => {
  const db = await fresh();
  for (const id of ids) {
    await as(db, id, "insert into profiles (id, display_name, country, city, xp) values ($1, $2, 'RO', 'Bucharest', 100)", [id, id === emma ? 'Mean Name' : `P${id.slice(-1)}`]);
    await as(db, id, "insert into daily_results (user_id, day_key, game, ms, stars) values ($1, $2, 'Gravity', 30000, 3)", [id, today]);
  }
  const shown = async () => (await as(db, ana, 'select * from xp_board($1)', ['world'])).rows.find(r => r.player === emma);

  await as(db, ana, 'select report_player($1)', [emma]);
  await as(db, bogdan, 'select report_player($1)', [emma]);
  // The same player reporting twice is still one report.
  await as(db, bogdan, 'select report_player($1)', [emma]);
  assert.equal((await shown()).display_name, 'Mean Name');

  await as(db, cara, 'select report_player($1)', [emma]);
  const hidden = await shown();
  assert.equal(hidden.display_name, 'Player 0000');
  assert.equal(hidden.city, null);
  const daily = (await as(db, dan, 'select * from daily_board($1, $2)', [today, 'world'])).rows.find(r => r.player === emma);
  assert.equal(daily.display_name, 'Player 0000');

  // A new name is a clean slate.
  await as(db, emma, "update profiles set display_name = 'Emma' where id = $1", [emma]);
  assert.equal((await shown()).display_name, 'Emma');
});
