import { GameKind, ROTATION, gameShortName } from '../game/journey';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { PlayerProgress } from './playerProgress';

/**
 * Errands: three small goals a day, each paying coins when it is claimed.
 *
 * They exist to give a player a reason to come back tomorrow that is not
 * the same reason as today, and to steer them round the whole almanac -
 * "solve two Bridges puzzles" sends someone who only ever plays Continue
 * into a game they might never have opened. The day's three are picked
 * from the date alone, so they are the same all day and different
 * tomorrow, with nothing to store but how far along each one is.
 */

export type ErrandKind = 'solve' | 'solveGame' | 'stars' | 'clean' | 'hard' | 'daily' | 'set';

export interface Errand {
  readonly kind: ErrandKind;
  readonly target: number;
  readonly game: GameKind | null;
  readonly coins: number;
  readonly title: string;
}

/** What one solve contributes. */
export interface SolveEvent {
  readonly kind: GameKind;
  readonly stars: number;
  /** Solved without a hint. */
  readonly clean: boolean;
  readonly difficulty: PuzzleDifficulty | null;
  readonly isDaily: boolean;
  readonly setCompleted: boolean;
}

/** Today's progress on today's errands. */
export interface ErrandLog {
  readonly dayKey: string;
  readonly progress: ReadonlyArray<number>;
  readonly claimed: ReadonlyArray<boolean>;
}

export const ERRANDS_PER_DAY = 3;

/* eslint-disable no-bitwise -- mulberry32 and FNV-1a are bitwise by definition */
function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

function make(kind: ErrandKind, random: () => number, allowed: ReadonlyArray<GameKind>): Errand {
  const pick = <T,>(options: ReadonlyArray<T>): T => options[Math.floor(random() * options.length)];
  switch (kind) {
    case 'solve': {
      const n = pick([3, 4, 5]);
      return { kind, target: n, game: null, coins: 15 + n * 3, title: `Solve ${n} puzzles` };
    }
    case 'solveGame': {
      const game = pick(allowed.length > 0 ? allowed : ROTATION);
      const n = pick([1, 2]);
      return { kind, target: n, game, coins: 20 + n * 5, title: n === 1 ? `Solve a ${gameShortName(game)} puzzle` : `Solve ${n} ${gameShortName(game)} puzzles` };
    }
    case 'stars': {
      const n = pick([6, 8, 10]);
      return { kind, target: n, game: null, coins: 12 + n * 2, title: `Earn ${n} stars` };
    }
    case 'clean': {
      const n = pick([2, 3]);
      return { kind, target: n, game: null, coins: 20 + n * 5, title: `Solve ${n} puzzles without a hint` };
    }
    case 'hard':
      return { kind, target: 1, game: null, coins: 35, title: 'Solve a hard puzzle' };
    case 'daily':
      return { kind, target: 1, game: null, coins: 20, title: "Solve today's Daily" };
    case 'set':
      return { kind, target: 1, game: null, coins: 30, title: 'Finish a level set' };
  }
}

/** The day's three errands - always one kind of each: a volume goal, a
 * game to visit, and a quality or occasion goal. */
export function errandsFor(dayKey: string, retired: ReadonlyArray<GameKind> = []): Errand[] {
  const random = seeded(`errands:${dayKey}`);
  // A retired game is never an errand's destination.
  const allowed = ROTATION.filter(kind => !retired.includes(kind));
  const volume: ErrandKind[] = ['solve', 'stars'];
  const quality: ErrandKind[] = ['clean', 'hard', 'daily', 'set'];
  return [
    make(volume[Math.floor(random() * volume.length)], random, allowed),
    make('solveGame', random, allowed),
    make(quality[Math.floor(random() * quality.length)], random, allowed),
  ];
}

/** Today's log - a fresh one if the saved log is from another day. */
export function errandLogFor(progress: PlayerProgress, dayKey: string): ErrandLog {
  const log = progress.errands;
  if (log && log.dayKey === dayKey) return log;
  return { dayKey, progress: new Array(ERRANDS_PER_DAY).fill(0), claimed: new Array(ERRANDS_PER_DAY).fill(false) };
}

function stepFor(errand: Errand, event: SolveEvent): number {
  switch (errand.kind) {
    case 'solve':
      return 1;
    case 'solveGame':
      return event.kind === errand.game ? 1 : 0;
    case 'stars':
      return event.stars;
    case 'clean':
      return event.clean ? 1 : 0;
    case 'hard':
      return event.difficulty === 'hard' ? 1 : 0;
    case 'daily':
      return event.isDaily ? 1 : 0;
    case 'set':
      return event.setCompleted ? 1 : 0;
  }
}

/** Moves today's errands along for one solve. */
export function advanceErrands(progress: PlayerProgress, dayKey: string, event: SolveEvent): PlayerProgress {
  const errands = errandsFor(dayKey, progress.retired);
  const log = errandLogFor(progress, dayKey);
  const next = log.progress.map((done, i) => Math.min(errands[i].target, done + stepFor(errands[i], event)));
  if (next.every((n, i) => n === log.progress[i]) && log === progress.errands) return progress;
  return { ...progress, errands: { ...log, progress: next } };
}

export function isErrandDone(errand: Errand, log: ErrandLog, index: number): boolean {
  return log.progress[index] >= errand.target;
}

/** Claims a finished errand's coins. Null if it is not finished or
 * already claimed. */
export function claimErrand(progress: PlayerProgress, dayKey: string, index: number): PlayerProgress | null {
  const errands = errandsFor(dayKey, progress.retired);
  const log = errandLogFor(progress, dayKey);
  if (index < 0 || index >= errands.length || log.claimed[index] || !isErrandDone(errands[index], log, index)) return null;
  const claimed = log.claimed.map((c, i) => c || i === index);
  return {
    ...progress,
    coins: progress.coins + errands[index].coins,
    errandsClaimed: progress.errandsClaimed + 1,
    errands: { ...log, claimed },
  };
}

/** Errands done but not yet claimed - a badge on Home. */
export function unclaimedErrands(progress: PlayerProgress, dayKey: string): number {
  const errands = errandsFor(dayKey, progress.retired);
  const log = errandLogFor(progress, dayKey);
  return errands.filter((errand, i) => isErrandDone(errand, log, i) && !log.claimed[i]).length;
}
