import { getLevelById } from '../levels';
import { getMirrorMazeById } from '../mirror';
import { getTentsTreesById } from '../tents';
import { getTowersById } from '../towers';
import { getBinairoById } from '../binairo';
import { getArukoneById } from '../arukone';
import { getFillaPixById } from '../fillapix';
import { getLightsOutById } from '../lightsout';
import { getAdjacentById } from '../adjacent';
import { getBloomById } from '../bloom';
import { getMosaicById } from '../mosaic';
import { getBridgesById } from '../bridges';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
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
export type GameKind = 'gravity' | 'mirror' | 'tents' | 'towers' | 'binairo' | 'arukone' | 'fillapix' | 'lightsout' | 'adjacent' | 'bloom' | 'mosaic' | 'bridges';

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
export const ROTATION: ReadonlyArray<GameKind> = ['gravity', 'mirror', 'tents', 'towers', 'binairo', 'arukone', 'fillapix', 'lightsout', 'adjacent', 'bloom', 'mosaic', 'bridges'];

/** What each game is called, in one place. `puzzleDisplayInfo` below reads
 * these for its `chapter` field, so a game renamed here is renamed
 * everywhere rather than in seven separate string literals. */
const DISPLAY_NAMES: Readonly<Record<GameKind, string>> = {
  gravity: 'Gravity',
  mirror: 'Mirror Maze',
  tents: 'Tents and Trees',
  towers: 'Skyscrapers',
  binairo: 'Twos',
  arukone: 'Twinpath',
  fillapix: 'Pixel Clues',
  lightsout: 'Lanterns',
  adjacent: 'Adjacent',
  bloom: 'Bloom',
  mosaic: 'Mosaic',
  bridges: 'Bridges',
};

/** A game's own display name - for anywhere that names the game itself
 * rather than one of its puzzles (the aptitude chart's axis labels and its
 * strongest/weakest line). */
export function gameDisplayName(kind: GameKind): string {
  return DISPLAY_NAMES[kind];
}

/** A short form that fits under a 26-point emblem on a phone-width chart,
 * where `Tents and Trees` and `Skyscrapers` do not. Only differs from
 * `gameDisplayName` where the full name is genuinely too long. */
export function gameShortName(kind: GameKind): string {
  switch (kind) {
    case 'mirror':
      return 'Mirror';
    case 'tents':
      return 'Tents';
    case 'towers':
      return 'Towers';
    case 'arukone':
      return 'Twinpath';
    case 'fillapix':
      return 'Pixels';
    case 'lightsout':
      return 'Lanterns';
    case 'gravity':
    case 'binairo':
    case 'adjacent':
    case 'bloom':
    case 'mosaic':
    case 'bridges':
      return DISPLAY_NAMES[kind];
  }
}

/** A puzzle's own display name and "chapter" (Gravity: its world/chapter
 * name; every other game: that game's own display name) - the two bits of
 * text every "here's what to play next" surface (the Home hero card, the
 * Daily card) needs - plus its `difficulty`, so those same surfaces can
 * say how hard a puzzle is before the player opens it, resolved directly
 * from a `(kind, puzzleId)` pair
 * rather than precomputed into any per-game pool. Returns `undefined` only
 * if `puzzleId` doesn't actually resolve inside its own game module (a
 * broken/stale reference - every real call site controls both `kind` and
 * `puzzleId` together, so this should never happen in practice, but a
 * lookup miss is a much better failure mode here than a thrown exception).
 */
export interface PuzzleDisplayInfo {
  readonly name: string;
  readonly chapter: string;
  /**
   * The shared three-tier vocabulary every game and the batch generator
   * already speak. Gravity's own richer four-tier `Difficulty` collapses
   * `'expert' -> 'hard'` here: this is the cross-game scale, and inventing
   * a fourth tier for one game's sake would mean every consumer having to
   * handle a value seven of the eight games can never produce.
   */
  readonly difficulty: PuzzleDifficulty;
}

export function puzzleDisplayInfo(kind: GameKind, puzzleId: string): PuzzleDisplayInfo | undefined {
  // Answered from the id alone, deliberately without building the board.
  // Home calls this for its hero card, and some generators are expensive
  // enough (Adjacent's deals and verifies a whole tray) that resolving a
  // name through them would stall the hub on a puzzle nobody has opened
  // yet.
  const endless = parseEndlessId(puzzleId);
  if (endless && endless.kind === kind) {
    return { name: endlessName(endless.index, kind), chapter: DISPLAY_NAMES[kind], difficulty: endless.tier };
  }

  switch (kind) {
    case 'gravity': {
      const level = getLevelById(puzzleId);
      if (!level) return undefined;
      return {
        name: level.name,
        chapter: getWorldForLevel(level.id)?.name ?? DISPLAY_NAMES.gravity,
        difficulty: level.difficulty === 'expert' ? 'hard' : level.difficulty,
      };
    }
    case 'mirror': {
      const puzzle = getMirrorMazeById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.mirror, difficulty: puzzle.difficulty };
    }
    case 'tents': {
      const puzzle = getTentsTreesById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.tents, difficulty: puzzle.difficulty };
    }
    case 'towers': {
      const puzzle = getTowersById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.towers, difficulty: puzzle.difficulty };
    }
    case 'binairo': {
      const puzzle = getBinairoById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.binairo, difficulty: puzzle.difficulty };
    }
    case 'arukone': {
      const puzzle = getArukoneById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.arukone, difficulty: puzzle.difficulty };
    }
    case 'fillapix': {
      const puzzle = getFillaPixById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.fillapix, difficulty: puzzle.difficulty };
    }
    case 'lightsout': {
      const puzzle = getLightsOutById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.lightsout, difficulty: puzzle.difficulty };
    }
    case 'adjacent': {
      const puzzle = getAdjacentById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.adjacent, difficulty: puzzle.difficulty };
    }
    case 'bloom': {
      const puzzle = getBloomById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.bloom, difficulty: puzzle.difficulty };
    }
    case 'mosaic': {
      const puzzle = getMosaicById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.mosaic, difficulty: puzzle.difficulty };
    }
    case 'bridges': {
      const puzzle = getBridgesById(puzzleId);
      if (!puzzle) return undefined;
      return { name: puzzle.name ?? puzzle.id, chapter: DISPLAY_NAMES.bridges, difficulty: puzzle.difficulty };
    }
  }
}

/**
 * Which game a puzzle id belongs to, and how hard it is - for anything
 * that sees only an id (the errands a solve advances). Endless ids name
 * their game; curated ones are asked of each game in turn, cheaply, from
 * the id alone (see `puzzleDisplayInfo`).
 */
export function puzzleKindOf(puzzleId: string): { kind: GameKind; difficulty: PuzzleDifficulty } | undefined {
  const endless = parseEndlessId(puzzleId);
  const named = endless && (ROTATION as ReadonlyArray<string>).includes(endless.kind) ? [endless.kind as GameKind] : ROTATION;
  for (const kind of named) {
    const info = puzzleDisplayInfo(kind, puzzleId);
    if (info) return { kind, difficulty: info.difficulty };
  }
  return undefined;
}
