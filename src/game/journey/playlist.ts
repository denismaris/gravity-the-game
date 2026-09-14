import { LEVELS } from '../levels';
import { MIRROR_MAZES } from '../mirror';
import { TENTS_TREES } from '../tents';
import { TOWERS } from '../towers';
import { BINAIRO } from '../binairo';
import { getWorldForLevel } from '../worlds';

/**
 * The Journey is one interleaved sequence across every game (see
 * `ROTATION` for the current lineup and order). It is dealt out in that
 * fixed rotation, taking the next unused puzzle of that game each time, and
 * it never places two puzzles of the same game back to back while more than
 * one game still has puzzles left. When the shorter pools run dry the rest
 * of the journey is whatever remains (in practice: the tail of the gravity
 * pack, by far the largest pool).
 */
export type GameKind = 'gravity' | 'mirror' | 'tents' | 'towers' | 'binairo';

export interface JourneyEntry {
  /** 1-based position in the whole journey. */
  readonly position: number;
  readonly kind: GameKind;
  /** Stable id of the puzzle, resolvable inside its own game module. */
  readonly puzzleId: string;
  readonly name: string;
  /** Gravity: the world/chapter name. Otherwise the game's name. */
  readonly chapter: string;
}

export const ROTATION: ReadonlyArray<GameKind> = ['gravity', 'mirror', 'tents', 'towers', 'binairo'];

interface PoolItem {
  readonly puzzleId: string;
  readonly name: string;
  readonly chapter: string;
}

function buildPools(): Record<GameKind, PoolItem[]> {
  const gravity: PoolItem[] = [...LEVELS]
    .sort((a, b) => a.order - b.order)
    .map(level => ({
      puzzleId: level.id,
      name: level.name,
      chapter: getWorldForLevel(level.id)?.name ?? 'Gravity',
    }));

  const mirror: PoolItem[] = MIRROR_MAZES.map(puzzle => ({
    puzzleId: puzzle.id,
    name: puzzle.name ?? puzzle.id,
    chapter: 'Mirror Maze',
  }));

  const tents: PoolItem[] = TENTS_TREES.map(puzzle => ({
    puzzleId: puzzle.id,
    name: puzzle.name ?? puzzle.id,
    chapter: 'Tents and Trees',
  }));

  const towers: PoolItem[] = TOWERS.map(puzzle => ({
    puzzleId: puzzle.id,
    name: puzzle.name ?? puzzle.id,
    chapter: 'Skyscrapers',
  }));

  const binairo: PoolItem[] = BINAIRO.map(puzzle => ({
    puzzleId: puzzle.id,
    name: puzzle.name ?? puzzle.id,
    chapter: 'Binairo',
  }));

  return { gravity, mirror, tents, towers, binairo };
}

export function buildJourney(): JourneyEntry[] {
  const queues = buildPools();
  const out: JourneyEntry[] = [];
  let cursor = 0;
  let lastKind: GameKind | null = null;

  const nonEmpty = (): GameKind[] => ROTATION.filter(k => queues[k].length > 0);

  while (nonEmpty().length > 0) {
    let picked: GameKind | null = null;
    for (let step = 0; step < ROTATION.length; step += 1) {
      const kind = ROTATION[(cursor + step) % ROTATION.length];
      if (queues[kind].length === 0) continue;
      if (kind === lastKind && nonEmpty().length > 1) continue;
      picked = kind;
      break;
    }
    if (picked === null) picked = nonEmpty()[0]; // only the last-used game is left

    const item = queues[picked].shift()!;
    out.push({
      position: out.length + 1,
      kind: picked,
      puzzleId: item.puzzleId,
      name: item.name,
      chapter: item.chapter,
    });
    lastKind = picked;
    cursor = (ROTATION.indexOf(picked) + 1) % ROTATION.length;
  }

  return out;
}

/** The full dealt journey. Static - the pools never change at runtime. */
export const JOURNEY: ReadonlyArray<JourneyEntry> = buildJourney();

export function journeyEntryOf(puzzleId: string): JourneyEntry | undefined {
  return JOURNEY.find(entry => entry.puzzleId === puzzleId);
}

/** The next entry of `kind` at or after `fromPosition` (1-based), or null. */
export function nextEntryOfKind(kind: GameKind, fromPosition: number): JourneyEntry | null {
  return JOURNEY.find(entry => entry.kind === kind && entry.position >= fromPosition) ?? null;
}

/**
 * The entry that immediately follows `puzzleId` in the interleaved Journey,
 * or `null` at the very end. This is what every completion screen's "Next"
 * action should advance to - it is what keeps finishing a puzzle rotating
 * toward whichever game comes next in the deal, rather than each game's own
 * "Next" quietly staying inside its own pool (Gravity chaining to Gravity,
 * forever, and never touching the other games).
 */
export function getNextJourneyEntry(puzzleId: string): JourneyEntry | null {
  const current = journeyEntryOf(puzzleId);
  if (!current) return null;
  return JOURNEY[current.position] ?? null; // `position` is 1-based, so this is the next index
}
