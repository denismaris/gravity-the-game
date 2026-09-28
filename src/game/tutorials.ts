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
 * cells, since it's the one rule that asks a player to hold a whole-board
 * relationship in their head rather than a purely local one, and finally
 * neighbour-count clues, the newest mechanic and the only one that talks
 * about a cell's surroundings rather than a line or a pair.
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
  {
    title: 'Counting clues',
    body: 'A number counts the circles directly above, below, left and right of it - exactly that many, no more.',
    illustration: 'count',
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

/**
 * Arukone+'s own mechanics. Three slides, in the order the player meets
 * them: what you are doing, the one thing that makes this game itself,
 * then what "finished" means.
 *
 * Slide 2 says more than the rule does. The board mirrors every step as it
 * is drawn (see `src/game/arukone/play.ts`), so "paths must be mirror-
 * symmetric" would describe a constraint the player cannot actually
 * break - and would leave them wondering why a second line appeared on
 * the far side of the board. Naming the mirroring is the difference
 * between the game's best moment reading as a feature and reading as a
 * bug.
 */
export const ARUKONE_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Join the pairs',
    body: 'Connect matching number pairs with paths - touch a number and drag through the squares beside it.',
    illustration: 'connect',
  },
  {
    title: 'The board folds',
    body: 'All paths are mirror-symmetric and route around obstacles. Draw one side and the other side draws itself, folded across the middle.',
    illustration: 'symmetry',
  },
  {
    title: 'Fill every square',
    body: 'Complete all pairs without crossing paths - and leave no square empty. Every square belongs to exactly one path.',
    illustration: 'crossing',
  },
];

/**
 * Fill-a-Pix's own mechanics. Three slides, in the order a player actually
 * needs them: the goal first (what tapping cells even does - there is no
 * board game precedent to lean on here the way "connect the pairs" or
 * "one tent per tree" can), then the one rule in full (counting *and*
 * diagonals together, since splitting them into two slides left the
 * diagonal rule floating with nothing concrete attached to it), then what
 * finishing looks like. The rule slide's own illustration shows an actual
 * clue digit rather than an abstract ring - the earlier version could
 * never do this (no Skia font, and the ring alone doesn't explain what a
 * number *means*), fixed in `FillaPixMechanicsIllustrations.tsx` with a
 * small hand-drawn digit renderer, the same technique this app's own
 * hand-stroked icons (the header's "?", the Undo/Restart arrows) already
 * use in place of a font.
 */
export const FILLAPIX_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Paint the hidden picture',
    body: 'Tap a cell to fill it in. The filled cells you leave behind form a small picture.',
    illustration: 'goal',
  },
  {
    title: 'A number counts its own 3x3',
    body: 'Each clue counts the filled cells in the block around it - all nine squares, corners and the clue\'s own square included. So a 0 means none of those nine are filled, and a 9 means every one of them is.',
    illustration: 'clue',
  },
  {
    title: 'Match every clue to solve it',
    body: 'Once every clue matches its number, the picture is complete.',
    illustration: 'reveal',
  },
];

/**
 * Lights Out's own mechanics. Three slides, the user's own copy expanded
 * only where it had to be: slide 2 is the whole game (a press flips a
 * *cross*, not a cell), and it is also the rule a player would otherwise
 * meet as a surprise and read as a bug - so its illustration draws the
 * cross rather than describing it, with the diagonals pointedly dark.
 */
export const LIGHTSOUT_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to toggle',
    body: 'Tap any light to switch it - on to off, off to on.',
    illustration: 'tap',
  },
  {
    title: 'Neighbours flip too',
    body: 'A tap never lands alone: the four lights directly above, below and beside it flip with it. Diagonals stay put.',
    illustration: 'cross',
  },
  {
    title: 'Turn them all off',
    body: 'The board is solved the moment every light is dark.',
    illustration: 'dark',
  },
];

export const BLOOM_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to turn',
    body: 'Tap a tile to turn it a quarter. Every line has to meet another line - none may stop in the open or run off the edge.',
    illustration: 'turn',
  },
  {
    title: 'Pins never turn',
    body: 'A tile with an ochre pin is fixed, and so is every knot - the tiles with two arcs. Read outward from them, and from the rim.',
    illustration: 'knot',
  },
  {
    title: 'Closed loops bloom',
    body: 'A loop that closes fills with colour. Close every loop, with no loose ends anywhere, to finish the board.',
    illustration: 'bloom',
  },
];

export const ADJACENT_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap a tile',
    body: 'Tap any tile that touches another of its own colour, and the whole connected run clears at once.',
    illustration: 'run',
  },
  {
    title: 'The tray falls in',
    body: 'Whatever sat above the gap drops straight down into it. Columns never slide sideways - what is in a column stays in it.',
    illustration: 'fall',
  },
  {
    title: 'Reach the target',
    body: 'Bigger runs are worth much more per tile, so hold your colours together. Hit the target score - or clear the tray outright - to finish.',
    illustration: 'target',
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
  arukone: {
    title: 'Arukone+',
    body: 'Drag from a number to its twin to join them, routing around the blocked squares. The board is folded down the middle: draw one side and the other side draws itself. Join every pair without two paths crossing, and fill every square, to solve it.',
  },
  fillapix: {
    title: 'Fill-a-Pix',
    body: 'Tap a cell to fill it, tap again to clear it. The filled cells form a hidden picture. Each clue counts the filled squares in its own 3x3 block - all nine, including the square the number sits on - match every clue to complete it.',
  },
  lightsout: {
    title: 'Lights Out',
    body: 'Tap a light to flip it - and the four lights directly above, below and beside it flip with it. Diagonals stay put. Turn every light off to solve the board.',
  },
  adjacent: {
    title: 'Adjacent',
    body: 'Tap any tile touching another of its own colour to clear the whole run, and whatever sat above it falls in. Bigger runs score far more per tile - reach the target score, or clear the tray, to finish.',
  },
  bloom: {
    title: 'Bloom',
    body: 'Tap a tile to turn it a quarter. Every line must meet another line - none may end in the open or run off the edge. Pinned knots never turn: read outward from them and from the rim. A loop that closes blooms; close them all to finish.',
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
