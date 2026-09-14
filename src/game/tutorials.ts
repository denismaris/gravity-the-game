import { GameKind } from './journey';
import { LevelDefinition } from './levels';

/** The `MechanicId` values that introduce something genuinely new to *see*
 * on the board and so earn their own one-time explainer. `gravity` /
 * `targets` / `multi-object` are covered by the Gravity game-intro tutorial
 * itself, not listed separately here. */
export type MechanicTutorialId = 'obstacles' | 'anchored' | 'portals' | 'gravity-zone' | 'hazard';

/** A tutorial's stable id, persisted in `Settings.seenTutorials` - never
 * rename or reuse one, or a returning player would see the wrong copy (or
 * silently skip a tutorial that's actually new to them). */
export type TutorialId = `game:${GameKind}` | `mechanic:${MechanicTutorialId}`;

export interface TutorialCopy {
  readonly title: string;
  readonly body: string;
}

const GAME_INTROS: Record<GameKind, TutorialCopy> = {
  gravity: {
    title: 'Gravity',
    body: 'Swipe any direction to pull every piece that way. Land each one on its ringed target to solve the board.',
  },
  mirror: {
    title: 'Mirror Maze',
    body: 'Tap a cell to place a mirror, tap again to rotate it, and once more to remove it. Route the beam through every gem to the target to solve it.',
  },
  tents: {
    title: 'Tents and Trees',
    body: 'Tap a cell to pitch a tent, tap again to cross it out as empty. Every tent needs exactly one tree beside it, and no two tents may touch - match every row and column\'s count to solve it.',
  },
  towers: {
    title: 'Skyscrapers',
    body: 'Fill every row and column with each height exactly once - tap a cell, then tap a number. The clues outside the grid show how many towers are visible from that side.',
  },
  binairo: {
    title: 'Binairo',
    body: 'Tap a cell to cycle a square, a circle, then blank. No three of the same in a row or column, and each needs an equal split of both, to solve it.',
  },
};

const MECHANIC_INTROS: Record<MechanicTutorialId, TutorialCopy> = {
  obstacles: {
    title: 'Obstacles',
    body: 'Solid blocks. Nothing can slide through or land on one - plan a route around them.',
  },
  anchored: {
    title: 'Anchored Pieces',
    body: 'This piece never moves. It blocks anything that slides into it, exactly like a wall.',
  },
  portals: {
    title: 'Portals',
    body: 'Slide into a ringed cell and come out the linked one, still moving the same direction.',
  },
  'gravity-zone': {
    title: 'Gravity Zone',
    body: 'Inside the tinted area, gravity always pulls the way the arrows point - no matter which way you swipe.',
  },
  hazard: {
    title: 'Hazard',
    body: 'Careful - sliding a piece onto one destroys it and ends the attempt. Route around it.',
  },
};

/** The one-time id for a game's own "how to play" overlay. */
export function tutorialIdForGame(kind: GameKind): TutorialId {
  return `game:${kind}`;
}

/** The one-time id for a single Gravity mechanic's overlay. */
export function tutorialIdForMechanic(mechanic: MechanicTutorialId): TutorialId {
  return `mechanic:${mechanic}`;
}

export function copyForTutorial(id: TutorialId): TutorialCopy {
  const key = id.slice(id.indexOf(':') + 1);
  return id.startsWith('game:')
    ? GAME_INTROS[key as GameKind]
    : MECHANIC_INTROS[key as MechanicTutorialId];
}

/**
 * The Gravity mechanics a level actually uses, in the fixed order new
 * players encounter them (matches the world progression: obstacles first,
 * hazards last) - the order candidate tutorials are offered in, so a level
 * combining several new mechanics at once still only interrupts play with
 * one overlay, the most foundational unseen one.
 */
export function mechanicsOf(level: LevelDefinition): MechanicTutorialId[] {
  const mechanics: MechanicTutorialId[] = [];
  if (level.obstacles.length > 0) mechanics.push('obstacles');
  if (level.anchors && level.anchors.length > 0) mechanics.push('anchored');
  if (level.portals && level.portals.length > 0) mechanics.push('portals');
  if (level.zone) mechanics.push('gravity-zone');
  if (level.hazards && level.hazards.length > 0) mechanics.push('hazard');
  return mechanics;
}

/**
 * The first id in `candidates` (checked in order) not yet in `seen`, or
 * `null` once every candidate has already been shown. A screen calls this
 * with its own priority-ordered candidate list so at most one tutorial ever
 * appears for a single puzzle open, however many are newly relevant.
 */
export function pickTutorial(
  seen: ReadonlyArray<string>,
  candidates: ReadonlyArray<TutorialId>,
): TutorialId | null {
  return candidates.find(id => !seen.includes(id)) ?? null;
}
