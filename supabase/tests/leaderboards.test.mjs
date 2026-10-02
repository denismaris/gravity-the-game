// The leaderboards: world, country and city boards for today's Daily and
// for all-time experience. Same harness as db.test.mjs.
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

const ids = Array.from({ length: 6 }, (_v, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
const [ana, bogdan, cara, dan, emma, finn] = ids;

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

const today = new Date().toISOString().slice(0, 10);

/** Six players: three in Bucharest (spelled three ways), one in Cluj, one
 * in Lyon, one who has said nothing about where they are. */
async function world(db) {
  const people = [
    [ana, 'Ana', 'RO', 'Bucharest', 900, 31000],
    [bogdan, 'Bogdan', 'RO', ' bucharest', 700, 45000],
    [cara, null, 'RO', 'BUCHAREST', 500, 52000],
    [dan, 'Dan', 'RO', 'Cluj', 1200, 40000],
    [emma, 'Emma', 'FR', 'Lyon', 2000, 29000],
    [finn, 'Finn', null, null, 300, 60000],
  ];
  for (const [id, name, country, city, xp, ms] of people) {
    await as(db, id, 'insert into profiles (id, display_name, country, city, xp) values ($1, $2, $3, $4, $5)', [id, name, country, city, xp]);
    await as(db, id, `insert into daily_results (user_id, day_key, game, ms, stars) values ($1, $2, 'Gravity', $3, 3)`, [id, today, ms]);
  }
}

const names = rows => rows.map(r => r.display_name);

test('daily: the world, the country, the city', async () => {
  const db = await fresh();
  await world(db);
  const board = async (id, scope) => (await as(db, id, 'select * from daily_board($1, $2)', [today, scope])).rows;

  assert.deepEqual(names(await board(ana, 'world')), ['Emma', 'Ana', 'Dan', 'Bogdan', 'Player 0000', 'Finn']);
  assert.deepEqual(names(await board(ana, 'country')), ['Ana', 'Dan', 'Bogdan', 'Player 0000']);
  // Three spellings of one city are one board.
  assert.deepEqual(names(await board(bogdan, 'city')), ['Ana', 'Bogdan', 'Player 0000']);
  const mine = (await board(bogdan, 'city')).find(r => r.is_me);
  assert.equal(Number(mine.place), 2);
  // Someone who has not said where they are has no country or city board.
  assert.deepEqual(await board(finn, 'country'), []);
  assert.deepEqual(await board(finn, 'city'), []);
});

test('daily: your own row shows even when you are outside the top', async () => {
  const db = await fresh();
  await world(db);
  const rows = (await as(db, finn, 'select * from daily_board($1, $2, $3)', [today, 'world', 2])).rows;
  assert.deepEqual(rows.map(r => [Number(r.place), r.display_name, r.is_me]), [
    [1, 'Emma', false],
    [2, 'Ana', false],
    [6, 'Finn', true],
  ]);
});

test('experience: ranked within the same scopes', async () => {
  const db = await fresh();
  await world(db);
  const board = async (id, scope) => (await as(db, id, 'select * from xp_board($1)', [scope])).rows;
  assert.deepEqual(names(await board(dan, 'world')), ['Emma', 'Dan', 'Ana', 'Bogdan', 'Player 0000', 'Finn']);
  assert.deepEqual(names(await board(dan, 'country')), ['Dan', 'Ana', 'Bogdan', 'Player 0000']);
  assert.deepEqual(names(await board(dan, 'city')), ['Dan']);
});

test('cities: suggestions are the spellings players already use, most popular first', async () => {
  const db = await fresh();
  await world(db);
  const rows = (await as(db, finn, 'select * from cities_in($1)', ['RO'])).rows;
  assert.deepEqual(rows.map(r => [r.city.trim().toLowerCase(), Number(r.players)]), [
    ['bucharest', 3],
    ['cluj', 1],
  ]);
});

test('profiles: country must be a country code, and a player edits only their own', async () => {
  const db = await fresh();
  await as(db, ana, 'insert into profiles (id, country) values ($1, $2)', [ana, 'RO']);
  await assert.rejects(as(db, bogdan, 'insert into profiles (id, country) values ($1, $2)', [bogdan, 'Romania']), /check/);
  const r = await as(db, bogdan, `update profiles set xp = 999999 where id = $1`, [ana]);
  assert.equal(r.affectedRows, 0);
});
