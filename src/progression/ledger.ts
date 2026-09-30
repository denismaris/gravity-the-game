import { GameKind, puzzleKindOf, ROTATION } from '../game/journey';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { PlayerProgress } from './playerProgress';

/**
 * The ledger: every game's own record, and the album of stamps it earns.
 *
 * Like experience, all of it is *derived* from `progress.levels` - never
 * a running tally that could drift - so a long-standing save opens the
 * album with every stamp it has already earned waiting to be claimed.
 */

/** Solves in one game that earn its stamps, and what each pays. */
export const STAMP_STEPS: ReadonlyArray<number> = [10, 25, 50, 100];
export const STAMP_NAMES: ReadonlyArray<string> = ['Bronze', 'Silver', 'Gold', 'Platinum'];
export const STAMP_COINS: ReadonlyArray<number> = [25, 50, 100, 200];

export interface GameLedger {
  readonly kind: GameKind;
  readonly solved: number;
  readonly stars: number;
  /** Three-star solves. */
  readonly perfect: number;
  readonly byTier: Readonly<Record<PuzzleDifficulty, number>>;
}

export type Ledger = Readonly<Record<GameKind, GameLedger>>;

export function ledgerOf(progress: PlayerProgress): Ledger {
  const rows = {} as Record<GameKind, { kind: GameKind; solved: number; stars: number; perfect: number; byTier: Record<PuzzleDifficulty, number> }>;
  for (const kind of ROTATION) rows[kind] = { kind, solved: 0, stars: 0, perfect: 0, byTier: { easy: 0, medium: 0, hard: 0 } };
  for (const [id, result] of Object.entries(progress.levels)) {
    const found = puzzleKindOf(id);
    if (!found) continue;
    const row = rows[found.kind];
    row.solved += 1;
    row.stars += result.stars;
    if (result.stars === 3) row.perfect += 1;
    row.byTier[found.difficulty] += 1;
  }
  return rows;
}

export function stampId(kind: GameKind, step: number): string {
  return `${kind}:${step}`;
}

export interface Stamp {
  readonly kind: GameKind;
  readonly step: number;
  /** 0-based, into `STAMP_STEPS`. */
  readonly rank: number;
  readonly earned: boolean;
  readonly claimed: boolean;
}

export function stampsOf(progress: PlayerProgress, ledger: Ledger, kind: GameKind): Stamp[] {
  return STAMP_STEPS.map((step, rank) => ({
    kind,
    step,
    rank,
    earned: ledger[kind].solved >= step,
    claimed: progress.stampsClaimed.includes(stampId(kind, step)),
  }));
}

export function unclaimedStamps(progress: PlayerProgress, ledger: Ledger = ledgerOf(progress)): Stamp[] {
  return ROTATION.flatMap(kind => stampsOf(progress, ledger, kind).filter(s => s.earned && !s.claimed));
}

/** Pays an earned stamp. Null if it is not earned, or already claimed. */
export function claimStamp(progress: PlayerProgress, kind: GameKind, step: number, ledger: Ledger = ledgerOf(progress)): PlayerProgress | null {
  const rank = STAMP_STEPS.indexOf(step);
  const id = stampId(kind, step);
  if (rank < 0 || ledger[kind].solved < step || progress.stampsClaimed.includes(id)) return null;
  return { ...progress, coins: progress.coins + STAMP_COINS[rank], stampsClaimed: [...progress.stampsClaimed, id] };
}
