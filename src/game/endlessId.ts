import { PuzzleDifficulty } from './puzzleDifficulty';

/**
 * Ids for puzzles that do not exist until someone asks for them.
 *
 * Every pool in this app is finite and hand-curated, which is right for
 * the opening hours and wrong for hour twenty: `availablePuzzleIds` used
 * to fall back to *replaying* the pool once a tier was exhausted, so a
 * player who finished a game simply started meeting the same boards
 * again with no acknowledgement that anything had changed.
 *
 * An endless id carries everything needed to rebuild its own puzzle -
 * the game, the tier and an index - so the board can be generated on
 * demand and then regenerated identically forever after. That last part
 * is not optional: `PlayerProgress.levels` keys a best result per id, so
 * an id that produced a different board on the next launch would silently
 * attach a player's stars to a puzzle they never played.
 *
 * Deliberately a *separate namespace* from the curated ids rather than a
 * continuation of their numbering. The curated pools stay exactly as they
 * are - finite, authored, and still the thing "solve every Lights Out
 * puzzle" means - and the endless stream begins where they run out.
 */

/** `lightsout-e-hard-7`: game, the endless marker, tier, index. */
const PATTERN = /^([a-z]+)-e-(easy|medium|hard)-(\d+)$/;

export interface EndlessRef {
  readonly kind: string;
  readonly tier: PuzzleDifficulty;
  readonly index: number;
}

export function endlessId(kind: string, tier: PuzzleDifficulty, index: number): string {
  return `${kind}-e-${tier}-${index}`;
}

/** The parts of an endless id, or `null` for a curated one. Cheap and
 * total - callers use it to decide whether to look a puzzle up or build
 * it, so it must never throw on an ordinary id. */
export function parseEndlessId(id: string): EndlessRef | null {
  const match = PATTERN.exec(id);
  if (!match) return null;
  return { kind: match[1], tier: match[2] as PuzzleDifficulty, index: Number(match[3]) };
}

export function isEndlessId(id: string): boolean {
  return PATTERN.test(id);
}

/**
 * A stable 32-bit seed for an endless id.
 *
 * Shared by every game that generates on demand so the same id always
 * rebuilds the same board, whichever module happens to ask first.
 */
/* eslint-disable no-bitwise -- FNV-1a is bitwise by definition */
export function endlessSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
/* eslint-enable no-bitwise */

/**
 * What an endless puzzle is called.
 *
 * Derived from the id rather than stored, and - importantly - derived
 * *without building the board*. Home asks for a puzzle's name to draw its
 * hero card, and generating a whole board to answer that would stall the
 * hub on a game whose generator is expensive (Adjacent's is ~70ms a
 * board). Names are therefore a pure function of the index.
 */
export function endlessName(index: number): string {
  return `No. ${index + 1}`;
}
