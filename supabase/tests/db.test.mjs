// The database's rules, tested against a real Postgres (PGlite, in
// process). Supabase's own `auth` schema and roles are stood in for by the
// few lines in `SUPABASE_STUB`, so the migration runs here exactly as it
// will on the hosted project.
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

const SUPABASE_STUB = readFileSync(join(here, 'supabase-stub.sql'), 'utf8');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

async function fresh() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}')`);
  return db;
}

/** Runs `sql` as a signed-in player (or as `anon` when `id` is null). */
async function as(db, id, sql, params = []) {
  await db.exec(id ? `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

test('saves: first write, then each write must name the revision it saw', async () => {
  const db = await fresh();
  const put = (base, coins) => as(db, A, 'select * from put_save($1, null, $2)', [JSON.stringify({ coins }), base]);

  let r = (await put(0, 10)).rows[0];
  assert.equal(r.ok, true);
  assert.equal(r.revision, 1);

  r = (await put(1, 20)).rows[0];
  assert.equal(r.ok, true);
  assert.equal(r.revision, 2);

  // A second device still on revision 1 is refused, and handed the server copy.
  r = (await put(1, 99)).rows[0];
  assert.equal(r.ok, false);
  assert.equal(r.revision, 2);
  assert.deepEqual(r.progress, { coins: 20 });
});

test('saves: a player sees only their own, and cannot write around put_save', async () => {
  const db = await fresh();
  await as(db, A, 'select * from put_save($1, null, 0)', [JSON.stringify({ coins: 5 })]);
  assert.equal((await as(db, A, 'select * from saves')).rows.length, 1);
  assert.equal((await as(db, B, 'select * from saves')).rows.length, 0);
  await assert.rejects(as(db, B, `insert into saves (user_id, progress) values ('${B}', '{}')`));
  await assert.rejects(as(db, B, `update saves set progress = '{}' where user_id = '${A}'`).then(r => {
    if (r.affectedRows === 0) throw new Error('blocked');
  }));
});

test('saves: signed-out callers cannot use put_save', async () => {
  const db = await fresh();
  await assert.rejects(as(db, null, 'select * from put_save($1, null, 0)', ['{}']));
});

test('daily: one result per player per day, today only', async () => {
  const db = await fresh();
  const submit = (id, day, ms, owner = id) =>
    as(db, id, `insert into daily_results (user_id, day_key, game, ms, stars) values ($1, $2, 'Gravity', $3, 3)`, [owner, day, ms]);

  await submit(A, today, 48000);
  await assert.rejects(submit(A, today, 30000), /duplicate key/);
  await assert.rejects(submit(B, daysAgo(3), 30000));
  await assert.rejects(submit(B, today, 30000, A));
  await assert.rejects(submit(B, today, 500), /check/);
  // Just after midnight: yesterday's Daily still counts.
  await submit(B, daysAgo(1), 30000);
});

test('daily: standings and the leaderboard, without anyone reading raw rows', async () => {
  const db = await fresh();
  for (const [id, ms] of [[A, 30000], [B, 45000], [C, 60000]]) {
    await as(db, id, `insert into daily_results (user_id, day_key, game, ms, stars) values ($1, $2, 'Gravity', $3, 2)`, [id, today, ms]);
  }
  await as(db, A, `insert into profiles (id, display_name) values ($1, 'Ada')`, [A]);

  // B reads nobody else's row directly.
  assert.equal((await as(db, B, 'select * from daily_results')).rows.length, 1);

  const standing = (await as(db, B, 'select * from daily_standing($1, $2)', [today, 45000])).rows[0];
  assert.equal(standing.players, 3);
  assert.equal(Number(standing.faster_than), 0.5);

  const board = (await as(db, B, 'select * from daily_leaderboard($1)', [today])).rows;
  assert.deepEqual(board.map(r => [Number(r.place), r.display_name, r.ms, r.is_me]), [
    [1, 'Ada', 30000, false],
    [2, null, 45000, true],
    [3, null, 60000, false],
  ]);
  await assert.rejects(as(db, null, 'select * from daily_leaderboard($1)', [today]));
});

test('profiles: a player names only themselves, within the length limits', async () => {
  const db = await fresh();
  await as(db, A, `insert into profiles (id, display_name) values ($1, 'Ada')`, [A]);
  await assert.rejects(as(db, B, `insert into profiles (id, display_name) values ($1, 'Mallory')`, [A]));
  await assert.rejects(as(db, B, `insert into profiles (id, display_name) values ($1, 'x')`, [B]), /check/);
  assert.equal((await as(db, B, 'select * from profiles')).rows.length, 0);
});

test('accounts: a player can delete their own account, and everything of theirs goes with it', async () => {
  const db = await fresh();
  await as(db, A, 'select * from put_save($1, null, 0)', [JSON.stringify({ coins: 5 })]);
  await as(db, A, `insert into profiles (id, display_name) values ($1, 'Ada')`, [A]);
  await as(db, A, `insert into daily_results (user_id, day_key, game, ms, stars) values ($1, $2, 'Gravity', 30000, 3)`, [A, today]);
  await as(db, B, 'select * from put_save($1, null, 0)', [JSON.stringify({ coins: 9 })]);

  await assert.rejects(as(db, null, 'select delete_my_account()'));
  await as(db, A, 'select delete_my_account()');

  const left = async table => (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n;
  assert.equal((await db.query(`select count(*)::int as n from auth.users where id = '${A}'`)).rows[0].n, 0);
  assert.equal(await left('profiles'), 0);
  assert.equal(await left('daily_results'), 0);
  // Only B's save is left.
  assert.equal(await left('saves'), 1);
});
