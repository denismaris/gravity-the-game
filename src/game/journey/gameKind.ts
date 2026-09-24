import { getLevelById } from '../levels';
import { getMirrorMazeById } from '../mirror';
import { getTentsTreesById } from '../tents';
import { getTowersById } from '../towers';
import { getBinairoById } from '../binairo';
import { getWorldForLevel } from '../worlds';

/**
 * The one shared "which game" vocabulary every puzzle-facing module in the
 * app keys off - screens, accent colours, tutorials, the batch generator.
 * Not a Journey-specific concept (this file used to also hold the
 * interleaved Journey playlist itself; that's gone, replaced by the
 * randomized level-batch system in `src/progression/batches.ts` - this
 * type, `ROTATION`, and `puzzleDisplayInfo` below are the parts of this
 * module that outlived that replacement, because they're about game
 * identity, not about any one ordering of puzzles).
 */
export type GameKind = 'gravity' | 'mirror' | 'tents' | 'towers' | 'binairo';

/** Passed by every game screen's own "Next" action alongside the target
 * puzzle - `App.tsx`'s `openPuzzle` reads `showInterstitial` to decide
 * whether to route through the calming interstitial (`src/interstitial/`)
 * before actually opening it. */
export interface NextPuzzleOptions {
  /** True iff the solve that triggered this "Next" was the one that
   * completed the current level's batch (see `CompletionOutcome.batchCompleted`
   * in `PlayerProgressProvider.tsx`), not a mid-batch advance. */
  readonly showInterstitial?: boolean;
}

/** The fixed lineup, in the app's own canonical game order - used anywhere
 * something needs to enumerate "every game" in one stable order (the batch
 * generator's own weighted sampling, Browse's old section order, etc.). */
export const ROTATION: ReadonlyArray<GameKind> = ['gravity', 'mirror', 'tents', 'towers', 'binairo'];

/** A puzzle's own display name and "chapter" (Gravity: its world/chapter
 * name; every other game: that game's own display name) - the two bits of
 * text every "here's what to play next" surface (the Home hero card, the
 * Daily card) needs, resolved directly from a `(kind, puzzleId)` pair
 * rather than precomputed into any per-game pool. Returns `undefined` only
 * if `puzzleId` doesn't actually resolve inside its own game module (a
 * broken/stale reference - every real call site controls both `kind` and
 * `puzzleId` together, so this should never happen in practice, but a
 * lookup miss is a much better failure mode here than a thrown exception).
 */
export function puzzleDisplayInfo(kind: GameKind, puzzleId: string): { name: string; chapter: string } | undefined {
  switch (kind) {
    case 'gravity': {
      const level = getLevelById(puzzleId);
      if (!level) return undefined;
      return { name: level.name, chapter: getWorldForLevel(level.id)?.name ?? 'Gravity' };
    }
    case 'mirror': {
      const puzzle = getMirrorMazeById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: 'Mirror Maze' };
    }
    case 'tents': {
      const puzzle = getTentsTreesById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: 'Tents and Trees' };
    }
    case 'towers': {
      const puzzle = getTowersById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: 'Skyscrapers' };
    }
    case 'binairo': {
      const puzzle = getBinairoById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: 'Binairo' };
    }
  }
}
