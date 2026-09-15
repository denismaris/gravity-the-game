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

/**
 * One page of a `MechanicsCarousel` (`src/components/MechanicsCarousel.tsx`)
 * - the multi-slide counterpart to `TutorialCopy` above, for a game whose
 * rules are better taught one mechanic at a time than crammed into a
 * single overlay's body text. `illustration` is an opaque key the
 * carousel's own renderer switches on to draw a small board-fragment
 * diagram for that slide; kept as a plain string here (rather than a
 * React node) so this file - imported by plain game logic, not just
 * screens - never needs to depend on React or Skia.
 */
export interface TutorialSlide {
  readonly title: string;
  readonly body: string;
  readonly illustration: string;
}

/**
 * Binairo's own mechanics, one slide per rule, in the order a player
 * actually meets them: the base toggle first, then the three base
 * validity rules, then the two constraint-badge kinds (both used from the
 * very first puzzle onward - see `BINAIRO[0].constraints`), then twin
 * cells last, since it's the one rule that asks a player to hold a
 * whole-board relationship in their head rather than a purely local one.
 */
export const BINAIRO_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to fill',
    body: 'Tap a cell to cycle it: blank, a blue square, a gold circle, then blank again.',
    illustration: 'toggle',
  },
  {
    title: 'No three in a row',
    body: "Three of the same shape in a row or column isn't allowed - hazard stripes flare up across the whole line the moment it happens.",
    illustration: 'triple',
  },
  {
    title: 'Keep it even',
    body: 'Every full row and column needs the same number of circles as squares.',
    illustration: 'balance',
  },
  {
    title: 'No repeats',
    body: 'No two rows - and no two columns - can end up identical.',
    illustration: 'duplicate',
  },
  {
    title: 'Equal badges',
    body: "A small '=' badge between two cells means they must match.",
    illustration: 'equal',
  },
  {
    title: 'Different badges',
    body: 'A small × badge means those two cells must differ.',
    illustration: 'different',
  },
  {
    title: 'Twin cells',
    body: "A small dot marks a cell as twinned with its mirror opposite, straight across the board's center. Twins always match.",
    illustration: 'twin',
  },
];

/**
 * Tents and Trees' own mechanics, one slide per rule, in the order a
 * player actually meets them: the tap cycle first, then the two
 * placement rules (a tree's own tent, no touching), then the row/column
 * counts that tie the whole board together.
 */
export const TENTS_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Pitch a tent',
    body: "Tap a cell to cycle it: empty, a tent, then a small mark for 'definitely not a tent.'",
    illustration: 'cycle',
  },
  {
    title: 'One tent per tree',
    body: 'Every tree hides exactly one tent, directly beside it - never diagonal.',
    illustration: 'adjacency',
  },
  {
    title: 'Tents never touch',
    body: "Two tents can't sit next to each other, not even diagonally.",
    illustration: 'touching',
  },
  {
    title: 'Match the count',
    body: 'Each row and column shows how many tents belong in it - fill exactly that many.',
    illustration: 'counts',
  },
];

/**
 * Gravity's own mechanics, one slide per rule: the swipe input first
 * (the one thing every level needs from the very first puzzle), then
 * what "solved" means (every piece on its target), then the one thing
 * that trips up a first-time player moving from Binairo/Tents/
 * Skyscrapers - a single swipe moves *every* piece on the board at once,
 * not just one. Gravity's other mechanics (obstacles, anchored pieces,
 * portals, gravity zones, hazards) stay on the existing progressive
 * single-page `TutorialOverlay` system (`MECHANIC_INTROS`/`mechanicsOf`
 * below) - they unlock world by world, so teaching them all up front here
 * would spoil mechanics a player hasn't met yet.
 */
export const GRAVITY_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Swipe to pull',
    body: 'Swipe any direction and every piece slides that way at once, like gravity flipping instantly.',
    illustration: 'swipe',
  },
  {
    title: 'Land on target',
    body: 'Every piece needs to land on its ringed target to solve the board.',
    illustration: 'target',
  },
  {
    title: 'Move together',
    body: 'One swipe moves every piece on the board - plan a direction that helps all of them, not just one.',
    illustration: 'multi',
  },
];

/**
 * Mirror Maze's own mechanics, one slide per rule, in the order a player
 * meets them: placing/cycling a mirror first, then what a mirror
 * actually does to the beam, then the two ways to solve - touch every
 * gem, then reach the target.
 */
export const MIRROR_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to place',
    body: 'Tap a cell to cycle it: no mirror, a "/" mirror, a "\\" mirror, then blank again.',
    illustration: 'place',
  },
  {
    title: 'Mirrors bend the beam',
    body: 'The beam runs straight from its source until it hits a mirror, which turns it a quarter turn.',
    illustration: 'reflect',
  },
  {
    title: 'Light every gem',
    body: 'Route the beam so it touches every gem on the board.',
    illustration: 'gems',
  },
  {
    title: 'Reach the target',
    body: 'Once the beam has touched every gem and reaches the target, the puzzle solves itself.',
    illustration: 'target',
  },
];

/**
 * Skyscrapers' own mechanics, one slide per rule: the tap-then-fill input
 * first, then the Latin-square rule every row/column follows, then the
 * one idea that's genuinely new to this game - a clue counts *visible*
 * towers, not a position or a total.
 */
export const TOWERS_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap and fill',
    body: 'Tap a cell, then tap a height below to fill it - tap the eraser to clear it again.',
    illustration: 'fill',
  },
  {
    title: 'Every height once',
    body: 'Each row and column needs every height from 1 to the grid size, exactly once.',
    illustration: 'unique',
  },
  {
    title: 'Clues count what you see',
    body: "Each clue outside the grid is how many towers you'd see looking straight in from that side - a taller tower hides every shorter one behind it.",
    illustration: 'visibility',
  },
];

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
