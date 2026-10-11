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
  /** How to *use* the rule - the strategy a good player reaches for -
   * shown under the body. */
  readonly tip?: string;
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
    body: "Tap a square to cycle it: empty, then a square, then a circle, then empty again. Every square on the board gets one of the two shapes.",
    illustration: 'toggle',
    tip: "Fill the squares you are sure of first. A wrong guess early on makes everything after it harder.",
  },
  {
    title: 'No three in a row',
    body: "Three of the same shape side by side in a row or column is never allowed. If it happens, a red outline appears around them.",
    illustration: 'triple',
    tip: "Two alike side by side? The squares at both ends must be the other shape. A gap between two alike is always the other shape too.",
  },
  {
    title: 'Keep it even',
    body: "Every row and column holds exactly as many circles as squares. A line with more than half of one shape turns red straight away.",
    illustration: 'balance',
    tip: "Count as you go: once a line has half of one shape, every empty square left in it is the other.",
  },
  {
    title: 'Equal badges',
    body: "An = sign between two squares means they hold the same shape.",
    illustration: 'equal',
    tip: "One known square settles its partner, and that can start a chain across the board.",
  },
  {
    title: 'Different badges',
    body: "A × sign between two squares means they hold different shapes.",
    illustration: 'different',
    tip: "One known square settles its partner, and that can start a chain across the board.",
  },
  {
    title: 'Twin cells',
    body: "A small dot marks a pair of twin squares, mirror opposites across the centre of the board. Twins always hold the same shape.",
    illustration: 'twin',
    tip: "Solve one twin and you get the other for free, on the far side of the board.",
  },
  {
    title: 'Counting clues',
    body: "A number counts the circles directly above, below, left and right of it. Exactly that many, no more and no less.",
    illustration: 'count',
    tip: "A 0 makes all four neighbours squares. Stuck anywhere? Insight shows your next move and explains which rule it uses.",
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
    body: "Swipe in any direction and every piece slides that way at once, until it meets a wall or another piece.",
    illustration: 'swipe',
    tip: "Pieces never stop halfway. Look for walls and blockers that stop a piece exactly where you need it.",
  },
  {
    title: 'Land on target',
    body: "Every piece has to finish on its ringed target, all at the same time, to solve the board.",
    illustration: 'target',
    tip: "Work backwards: from which side can each piece slide into its target and stop there?",
  },
  {
    title: 'Move together',
    body: "One swipe moves every piece. A move that helps one piece can push another out of place.",
    illustration: 'multi',
    tip: "Bring the hardest piece home first, then use the others as stoppers. Undo is free, and Insight shows the next swipe.",
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
    body: "Tap a square to cycle it: no mirror, a / mirror, a \\ mirror, then empty again.",
    illustration: 'place',
    tip: "You only need a mirror where the beam has to turn. Keep the rest of the board empty.",
  },
  {
    title: 'Mirrors bend the beam',
    body: "The beam runs straight from its source until it meets a mirror, which turns it a quarter turn.",
    illustration: 'reflect',
    tip: "Trace the beam with your finger from the source to see where it goes next.",
  },
  {
    title: 'Light every gem',
    body: "The beam must pass through every gem on the board on its way.",
    illustration: 'gems',
    tip: "Plan the route through the gems first, then decide where each turn goes.",
  },
  {
    title: 'Reach the target',
    body: "Once the beam has passed every gem and ends on the target, the puzzle is solved.",
    illustration: 'target',
    tip: "Stuck? Insight follows your own beam and fixes the first mirror that sends it astray.",
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
    body: "Connect each pair of matching numbers with a path. Touch a number and drag through the squares next to it.",
    illustration: 'connect',
    tip: "Start with the pairs closest together. They have the fewest ways to join.",
  },
  {
    title: 'The board folds',
    body: "Paths are mirror images across the middle of the board. Draw one side and the other side draws itself.",
    illustration: 'symmetry',
    tip: "Plan on one half only: whatever fits there fits on the other side too.",
  },
  {
    title: 'Fill every square',
    body: "Paths may not cross, and every square must belong to exactly one path, with none left empty.",
    illustration: 'crossing',
    tip: "Hug the walls: a path along the edge blocks the fewest other pairs. Stuck? Insight joins the next pair for you.",
  },
];

/**
 * Stained Glass in three slides: what a tap does, the one rule (shown
 * broken, ringed red, since a clash is what the player will actually
 * see), and what a finished window looks like.
 */
export const GLASS_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Glaze the panes',
    body: "Pick a glass from the tray under the window, then tap a pane to set it. Draw across several panes to glaze them in one stroke.",
    illustration: 'colour',
    tip: "Tap a pane again in the same glass to take it out, or pick the clear slot and draw.",
  },
  {
    title: 'Touching panes differ',
    body: "Two panes that share a strip of lead can never be the same colour. If they are, both are ringed in red until one changes.",
    illustration: 'clash',
    tip: "Panes that only meet at a corner may match. Start with a pane that already touches two colours: it has one glass left.",
  },
  {
    title: 'Let the light through',
    body: "Glaze every pane with no two neighbours alike and the window is finished. There is only ever one way to do it.",
    illustration: 'finish',
    tip: "Stuck? Insight sets the pane the window is readiest for, and says why.",
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
    body: "Tap a lantern to switch it on or off.",
    illustration: 'tap',
    tip: "Tapping the same lantern twice undoes it, so each lantern is tapped once or not at all.",
  },
  {
    title: 'Neighbours flip too',
    body: "Every tap also flips the four lanterns directly above, below, left and right of it. Diagonals stay as they are.",
    illustration: 'cross',
    tip: "The order of your taps never matters, only which lanterns you tap.",
  },
  {
    title: 'Turn them all off',
    body: "The puzzle is solved the moment every lantern is dark.",
    illustration: 'dark',
    tip: "Work row by row: to put out a lit lantern, tap the one just below it. Stuck? Insight shows the next tap.",
  },
];

export const BLOOM_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to turn',
    body: "Tap a tile to turn it a quarter. Every line on a tile must meet a line from its neighbour. None may end in the open or run off the edge.",
    illustration: 'turn',
    tip: "Start at the edges and corners: a line can never point off the board, so those tiles have few ways to turn.",
  },
  {
    title: 'Pins never turn',
    body: "A tile with an ochre pin is fixed in place, and so is every knot (a tile with two arcs). They are your starting points.",
    illustration: 'knot',
    tip: "Read outwards from the pins: each fixed line tells its neighbour which way to face.",
  },
  {
    title: 'Closed loops bloom',
    body: "A loop that closes fills with colour. Close every loop, with no loose ends anywhere, to finish the board.",
    illustration: 'bloom',
    tip: "A loose end always points at the tile that needs turning. Stuck? Insight turns the tile closest to settled.",
  },
];

export const MOSAIC_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Drag into the picture',
    body: "Lift a piece from the tray and drop it onto the picture. A shadow shows where it will land. The flat pieces are already set to start you off.",
    illustration: 'drag',
    tip: "Begin with the corners and narrow gaps: only a few pieces fit there.",
  },
  {
    title: 'Tap to turn',
    body: "Tap a piece in the tray to turn it a quarter. Drag a placed piece back out at any time.",
    illustration: 'turn',
    tip: "Turn a piece before you lift it, so you can see whether it matches the gap.",
  },
  {
    title: 'Fill every square',
    body: "Every piece fits in exactly one place, and together they cover every square of the picture.",
    illustration: 'fill',
    tip: "Place the awkward shapes early while there is still room. Stuck? Insight places the piece the picture is readiest for.",
  },
];

export const BRIDGES_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Drag or tap to build',
    body: "Drag from one island towards another, or tap the water between them, to build a bridge. Bridges run straight: up, down, left or right.",
    illustration: 'drag',
    tip: "Tap the same bridge again for a double bridge, and once more to take it away.",
  },
  {
    title: 'Meet every number',
    body: "Each number says how many bridges that island needs. When it has them all, it raises a flag. Two islands can share one bridge or two.",
    illustration: 'double',
    tip: "An island whose number is twice its neighbours needs a double bridge to every one of them.",
  },
  {
    title: 'One archipelago',
    body: "Bridges never cross each other, and in the end every island must be joined into one network.",
    illustration: 'network',
    tip: "Never close a finished group off from the rest. Stuck? Insight builds the bridge the numbers force.",
  },
];

export const ADJACENT_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap a tile',
    body: "Tap any tile that touches another of its own colour, and the whole connected group clears at once.",
    illustration: 'run',
    tip: "Press and hold to preview a group before it clears.",
  },
  {
    title: 'The tray falls in',
    body: "Tiles above a gap fall straight down to fill it. Columns never slide sideways, so what is in a column stays in it.",
    illustration: 'fall',
    tip: "Clearing a small group can drop two bigger ones together into one large group.",
  },
  {
    title: 'Reach the target',
    body: "Bigger groups score much more per tile. Reach the target score, or clear the whole tray, to finish.",
    illustration: 'target',
    tip: "Save your big groups until they grow. Stuck? Insight looks ahead and points at the best tap.",
  },
];

/** Lily Pads, on trial: the hop, the sinking pad, the warning, the end. */
export const LILY_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Hop in a line',
    body: 'Tap a pad in line with the frog, or swipe toward it. The frog hops to the nearest pad that way, clean over open water.',
    illustration: 'hop',
    tip: 'Pale rings show every pad the frog can reach from where it sits.',
  },
  {
    title: 'The pad behind sinks',
    body: 'Each pad the frog leaves goes under, so there is no hopping back. Every hop uses a pad up for good.',
    illustration: 'sink',
    tip: 'Undo takes a hop back whenever you like.',
  },
  {
    title: 'Lotus pads',
    body: 'A pad with a lotus survives the first visit: when the frog leaves, only the lotus sinks. Come back to it later, and then it sinks for good.',
    illustration: 'lotus',
    tip: 'While a lotus pad floats it stops every hop along its row and column. Use it as a stepping stone.',
  },
  {
    title: 'Leave no pad behind',
    body: 'A pad with nothing left in its row or its column can never be reached. It is ringed in red the moment that happens.',
    illustration: 'cutoff',
    tip: 'Visit pads at the ends of rows and in corners early, while a way back is still open.',
  },
  {
    title: 'Clear the pond',
    body: 'Visit every pad, ending on the last one, and a water lily opens under the frog.',
    illustration: 'clear',
    tip: 'Stuck? Insight finds a hop that keeps every pad in reach, going back first if it has to.',
  },
];

/** Weathervanes, on trial: the turn, the wind, what goes wrong, the loop. */
export const VANE_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Turn the vanes',
    body: 'Tap a vane to turn it a quarter, clockwise. It points at the nearest vane that way, along its row or column.',
    illustration: 'turn',
    tip: 'Vanes on a coloured plate are set from the start and never turn. Begin beside them.',
  },
  {
    title: 'Follow the wind',
    body: 'A dashed line shows where each vane sends its wind. A vane the wind reaches wears a blue ring.',
    illustration: 'wind',
    tip: 'Every vane needs exactly one wind arriving: no more, no fewer.',
  },
  {
    title: 'Three things go wrong',
    body: 'Wind blowing into open air, two vanes pointing at each other, or two winds into the same vane. Each one turns red.',
    illustration: 'trouble',
    tip: 'A vane in a corner has only two ways to point. Start there.',
  },
  {
    title: 'Chimneys',
    body: 'Wind does not pass a chimney. A vane pointing at one points into open air.',
    illustration: 'chimney',
    tip: 'A chimney between two vanes takes a way away from both. Start beside it.',
  },
  {
    title: 'Close the loops',
    body: 'When the wind runs round in closed loops through every vane, the roof is set. A loop turns solid the moment it closes.',
    illustration: 'loop',
    tip: 'Stuck? Insight turns the vane the others already force, and says why.',
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
  lilypads: {
    title: 'Lily Pads',
    body: 'Tap a pad in line with the frog, or swipe toward it, and the frog hops to the nearest pad that way. The pad it leaves sinks. A lotus pad sinks only its lotus the first time, so the frog must come back to it. Visit every pad to clear the pond.',
  },
  vanes: {
    title: 'Weathervanes',
    body: 'Tap a vane to turn it a quarter. Each points at the nearest vane that way, and wind does not pass a chimney. Every vane must point at another, be reached by exactly one, and never point straight back. Then the wind runs round in loops.',
  },
  binairo: {
    title: 'Twos',
    body: 'Tap a square to cycle it: a square shape, a circle, then empty. Never three of the same side by side, and every row and column splits evenly between the two shapes.',
  },
  arukone: {
    title: 'Twinpath',
    body: 'Drag from a number to its twin to join them, routing around the blocked squares. The board is folded down the middle: draw one side and the other side draws itself. Join every pair without two paths crossing, and fill every square, to solve it.',
  },
  glass: {
    title: 'Stained Glass',
    body: 'Pick a glass from the tray, then tap a pane or draw across several to set it. Two panes that share lead can never be the same colour. Glaze every pane to finish the window.',
  },
  lightsout: {
    title: 'Lanterns',
    body: 'Tap a lantern to switch it, and the four lanterns directly above, below and beside it switch with it. Diagonals stay as they are. Put every lantern out to solve the board.',
  },
  adjacent: {
    title: 'Adjacent',
    body: 'Tap any tile touching another of its own colour to clear the whole run, and whatever sat above it falls in. Bigger runs score far more per tile. Reach the target score, or clear the tray, to finish.',
  },
  bloom: {
    title: 'Bloom',
    body: 'Tap a tile to turn it a quarter. Every line must meet another line. None may end in the open or run off the edge. Pinned knots never turn: read outward from them and from the rim. A loop that closes blooms; close them all to finish.',
  },
  bridges: {
    title: 'Bridges',
    body: 'Drag from one island toward another, or tap the water between them, to lay a bridge. Each number is how many bridges that island needs. One or two may join any pair. Bridges never cross, and every island must end up connected into one network.',
  },
  mosaic: {
    title: 'Mosaic',
    body: 'Drag the pieces from the tray into the picture. Tap a piece in the tray to turn it. Some pieces are already set, flush in the picture, to start you off. Cover every square. There is only one way it all fits. Narrow places first.',
  },
};

const MECHANIC_INTROS: Record<MechanicTutorialId, TutorialCopy> = {
  obstacles: {
    title: 'Obstacles',
    body: 'Solid blocks. Nothing can slide through or land on one. Plan a route around them.',
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
    body: 'Inside the tinted area, gravity always pulls the way the arrows point, no matter which way you swipe.',
  },
  hazard: {
    title: 'Hazard',
    body: 'Careful. Sliding a piece onto one destroys it and ends the attempt. Route around it.',
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
