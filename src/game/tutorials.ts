import { GameKind } from './journey';
import { LevelDefinition } from './levels';

/** The `MechanicId` values that introduce something genuinely new to *see*
 * on the board and so earn their own one-time explainer. `gravity` /
 * `targets` / `multi-object` are covered by the Gravity game-intro tutorial
 * itself, not listed separately here. */
export type MechanicTutorialId = 'obstacles' | 'anchored' | 'portals' | 'gravity-zone' | 'hazard' | 'sand';

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
    body: "Tap a square to fill it. Tap once for a square, twice for a circle, and three times to empty it again.",
    illustration: 'toggle',
    tip: "Only fill a square when you are sure. A guess now makes everything harder later.",
  },
  {
    title: 'No three in a row',
    body: "Never put three of the same shape next to each other, across or down. If you do, they turn red.",
    illustration: 'triple',
    tip: "See two the same side by side? The squares at both ends must be the other shape.",
  },
  {
    title: 'Keep it even',
    body: "Every row and every column has the same number of circles and squares.",
    illustration: 'balance',
    tip: "When a line has all the circles it needs, fill the rest of it with squares.",
  },
  {
    title: 'Equal badges',
    body: "An = sign between two squares means they are the same shape.",
    illustration: 'equal',
    tip: "Know one of them? Then you know the other one too.",
  },
  {
    title: 'Different badges',
    body: "A × sign between two squares means they are different shapes.",
    illustration: 'different',
    tip: "Know one of them? Then the other one is the opposite shape.",
  },
  {
    title: 'Twin cells',
    body: "Two squares with a small dot are twins. Twins are always the same shape.",
    illustration: 'twin',
    tip: "Fill one twin and you know the other one too.",
  },
  {
    title: 'Counting clues',
    body: "A number tells you how many circles touch it: above, below, left and right.",
    illustration: 'count',
    tip: "A 0 means all four squares around it are squares. Stuck? Insight shows your next move.",
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
    body: "Swipe the board. Every ball rolls that way until it hits a wall or another ball.",
    illustration: 'swipe',
    tip: "A ball never stops by itself. Look for walls that stop it in just the right spot.",
  },
  {
    title: 'Land on target',
    body: "Get every ball onto a ring at the same time. Then you win.",
    illustration: 'target',
    tip: "Think backwards: from which side can a ball roll into its ring and stop there?",
  },
  {
    title: 'Move together',
    body: "One swipe moves all the balls at once. A good move for one ball can be a bad move for another.",
    illustration: 'multi',
    tip: "Get the trickiest ball home first. Stuck? Insight makes the next move for you.",
  },
  {
    title: 'Soft sand',
    body: "Some boards have sand. A ball that rolls onto sand stops there. Swipe again and it rolls on.",
    illustration: 'sand',
    tip: "Use sand to stop a ball where there is no wall.",
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
    body: "Tap a square to put a mirror there. Tap again to tilt it the other way. Tap once more to take it away.",
    illustration: 'place',
    tip: "Only put a mirror where the light needs to turn.",
  },
  {
    title: 'Mirrors bend the beam',
    body: "The light goes in a straight line. When it hits a mirror, it turns.",
    illustration: 'reflect',
    tip: "Follow the light with your finger to see where it goes.",
  },
  {
    title: 'Light every gem',
    body: "The light has to pass through every gem.",
    illustration: 'gems',
    tip: "First find a path through all the gems. Then add the mirrors.",
  },
  {
    title: 'Reach the target',
    body: "When the light has touched every gem and ends in the gold ring, you win.",
    illustration: 'target',
    tip: "Stuck? Insight fixes the first mirror that sends the light the wrong way.",
  },
  {
    title: 'Ruby light',
    body: "Gems with a red ring only light up with red light. The light turns red when it goes through the square of red glass.",
    illustration: 'ruby',
    tip: "Left: the light reaches the red gem first, so the gem stays dark. Right: the light goes through the red glass first, so the gem lights up.",
  },
  {
    title: 'Splitters',
    body: "A crystal splits the light in two. Both parts can light gems. One part must reach the gold ring.",
    illustration: 'splitter',
    tip: "Give each part a job: one goes to the ring, the other lights the gems.",
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
    body: "Draw a path to join each pair of matching numbers. Start on a number and drag.",
    illustration: 'connect',
    tip: "Start with the pairs that are close together.",
  },
  {
    title: 'The board folds',
    body: "The board is like a mirror. When you draw on one side, the same path appears on the other side.",
    illustration: 'symmetry',
    tip: "Just think about one half. The other half copies it.",
  },
  {
    title: 'Fill every square',
    body: "Paths cannot cross. Every square must be part of a path.",
    illustration: 'crossing',
    tip: "Paths along the edges get in the way less. Stuck? Insight joins the next pair for you.",
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
    body: "Pick a colour from the tray. Then tap a piece of glass to colour it. You can also drag across several pieces.",
    illustration: 'colour',
    tip: "Tap a piece again to take its colour off.",
  },
  {
    title: 'Touching panes differ',
    body: "Two pieces of glass that touch along a side cannot be the same colour. If they are, they glow red.",
    illustration: 'clash',
    tip: "Pieces that only touch at a corner can match. Start with a piece that already touches two colours.",
  },
  {
    title: 'Let the light through',
    body: "Colour every piece so no two touching pieces match. Then the window is done.",
    illustration: 'finish',
    tip: "Stuck? Insight colours the next piece and tells you why.",
  },
  {
    title: 'Vines',
    body: "Some windows have a vine joining two leaf pieces. One of them is green and the other is not. No other piece is ever green.",
    illustration: 'leaf',
    tip: "A leaf next to green cannot be green. A leaf next to red, blue and yellow must be green.",
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
    body: "Tap a lantern to turn it on or off.",
    illustration: 'tap',
    tip: "Tapping the same lantern twice puts it back. So tap each one once, or not at all.",
  },
  {
    title: 'Neighbours flip too',
    body: "A tap also switches the lanterns right above, below, left and right of it. The corners stay the same.",
    illustration: 'cross',
    tip: "The order you tap in does not matter.",
  },
  {
    title: 'Turn them all off',
    body: "Turn off every lantern to win.",
    illustration: 'dark',
    tip: "Go row by row. To turn off a lit lantern, tap the one just under it. Stuck? Insight shows the next tap.",
  },
];

export const BLOOM_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap to turn',
    body: "Tap a tile to turn it. Every line must join the line on the next tile. No line can stop in the middle or run off the edge.",
    illustration: 'turn',
    tip: "Start at the edges and corners. Tiles there have fewer ways to turn.",
  },
  {
    title: 'Pins never turn',
    body: "Tiles with a gold dot never turn. Use them as your starting point.",
    illustration: 'knot',
    tip: "Look at the tiles next to a fixed one. Its lines show which way they must face.",
  },
  {
    title: 'Closed loops bloom',
    body: "When a line goes all the way round and joins itself, it fills with colour. Close every loop to win.",
    illustration: 'bloom',
    tip: "A loose end points at the tile you need to turn. Stuck? Insight turns a tile for you.",
  },
  {
    title: 'Twin tiles',
    body: "Two tiles with matching rings are twins. When you turn one, the other turns too.",
    illustration: 'twins',
    tip: "Get one twin right and the other is right too.",
  },
];

export const MOSAIC_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Drag into the picture',
    body: "Drag a piece from the tray onto the picture. A shadow shows where it will land. Some pieces are already in place to help you.",
    illustration: 'drag',
    tip: "Start with corners and small gaps. Only a few pieces fit there.",
  },
  {
    title: 'Tap to turn',
    body: "Tap a piece in the tray to turn it. You can drag a piece back out at any time.",
    illustration: 'turn',
    tip: "Turn a piece first, to see if it matches the gap.",
  },
  {
    title: 'Fill every square',
    body: "Every piece has one right spot. Together they fill the whole picture.",
    illustration: 'fill',
    tip: "Place the odd shapes early, while there is still room. Stuck? Insight places a piece for you.",
  },
];

export const BRIDGES_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Drag or tap to build',
    body: "Drag from one island to another, or tap the water between them, to build a bridge. Bridges go straight: up, down, left or right.",
    illustration: 'drag',
    tip: "Tap a bridge again to make it double. Tap once more to take it away.",
  },
  {
    title: 'Meet every number',
    body: "The number on an island says how many bridges it needs. When it has them all, it raises a flag. Two islands can share one or two bridges.",
    illustration: 'double',
    tip: "If an island has only one neighbour, all its bridges go to that neighbour.",
  },
  {
    title: 'No crossing',
    body: "Bridges cannot cross each other. When every island has all its bridges, you win.",
    illustration: 'network',
    tip: "Stuck? Insight builds the next bridge for you.",
  },
  {
    title: 'Islands in fog',
    body: "Some islands hide in fog, so you cannot see their number. Work it out from the islands around them.",
    illustration: 'fog',
    tip: "Finish the islands around the fog first. What they still need is the fog island's number.",
  },
];

export const ADJACENT_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Tap a tile',
    body: "Tap a tile that touches another tile of the same colour. The whole group disappears.",
    illustration: 'run',
    tip: "Press and hold to see the group before it goes.",
  },
  {
    title: 'The tray falls in',
    body: "Tiles above an empty space fall down to fill it. They never slide sideways.",
    illustration: 'fall',
    tip: "Clearing a small group can bring two big groups together.",
  },
  {
    title: 'Reach the target',
    body: "Bigger groups give you many more points. Reach the target score, or clear every tile, to win.",
    illustration: 'target',
    tip: "Let groups grow before you tap them. Stuck? Insight shows the best tap.",
  },
  {
    title: 'Stones',
    body: "Grey stones never join a group. Clear all the tiles under a stone and it falls and breaks, for 200 points.",
    illustration: 'stone',
    tip: "Dig under stones with big groups. You get points for both.",
  },
  {
    title: 'Gold tiles',
    body: "A gold tile joins any colour group it touches. A group with gold scores double.",
    illustration: 'gold',
    tip: "Gold can only join one group. Use it on the biggest.",
  },
];

/** Lily Pads, on trial: the hop, the sinking pad, the warning, the end. */
export const LILY_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Hop in a line',
    body: 'Tap a pad in a straight line from the frog, or swipe toward it. The frog jumps to the nearest pad that way.',
    illustration: 'hop',
    tip: 'Pale rings show the pads the frog can jump to.',
  },
  {
    title: 'The pad behind sinks',
    body: 'When the frog jumps off a pad, the pad sinks. The frog cannot go back to it.',
    illustration: 'sink',
    tip: 'Made a mistake? Undo takes a jump back.',
  },
  {
    title: 'Lotus pads',
    body: 'A pad with a flower does not sink the first time. When the frog leaves, only the flower sinks. The frog can come back to it once more.',
    illustration: 'lotus',
    tip: 'While it floats, a flower pad stops jumps like any pad. Use it as a stepping stone.',
  },
  {
    title: 'Leave no pad behind',
    body: 'If a pad has no other pad left in its row or column, the frog can never reach it. It gets a red ring.',
    illustration: 'cutoff',
    tip: 'Visit the pads at the ends and in the corners early.',
  },
  {
    title: 'Clear the pond',
    body: 'Visit every pad. When the frog lands on the last one, a flower opens. You did it!',
    illustration: 'clear',
    tip: 'Stuck? Insight finds a safe jump for you.',
  },
  {
    title: 'Stepping stones',
    body: 'Some ponds have grey stones. The frog can land on a stone as often as it likes. Stones never sink, and you do not have to visit them.',
    illustration: 'stones',
    tip: 'A stone stops a jump like a pad, so it can help the frog reach far pads.',
  },
];

/** Weathervanes, on trial: the turn, the wind, what goes wrong, the loop. */
export const VANE_MECHANICS_SLIDES: ReadonlyArray<TutorialSlide> = [
  {
    title: 'Turn the vanes',
    body: 'Tap a vane to turn it. It points at the nearest vane in that direction.',
    illustration: 'turn',
    tip: 'Copper vanes on a square plate never turn. Start next to them.',
  },
  {
    title: 'Follow the wind',
    body: 'A line shows where each vane blows its wind. A vane that gets wind gets a blue ring.',
    illustration: 'wind',
    tip: 'Each vane must get wind from exactly one other vane.',
  },
  {
    title: 'Three things go wrong',
    body: 'Three things are not allowed: wind blowing off the roof, two vanes pointing at each other, and two vanes blowing at the same vane. Each one turns red.',
    illustration: 'trouble',
    tip: 'A vane in a corner can only point two ways. Start there.',
  },
  {
    title: 'Chimneys',
    body: 'Wind cannot go through a chimney. A vane pointing at a chimney blows its wind away.',
    illustration: 'chimney',
    tip: 'A chimney blocks a direction for the vanes next to it. Start there.',
  },
  {
    title: 'Close the loops',
    body: 'When the wind goes round and round through every vane, you win. Each finished loop lights up.',
    illustration: 'loop',
    tip: 'Stuck? Insight turns the next vane and tells you why.',
  },
];

const GAME_INTROS: Record<GameKind, TutorialCopy> = {
  gravity: {
    title: 'Gravity',
    body: 'Swipe to roll every ball that way. Get each ball onto a ring to win.',
  },
  mirror: {
    title: 'Mirror Maze',
    body: 'Tap a square to add a mirror. Tap again to tilt it, and again to take it away. Bend the light through every gem and into the gold ring.',
  },
  lilypads: {
    title: 'Lily Pads',
    body: 'Tap a pad in line with the frog to jump there. The pad it leaves sinks. A flower pad only loses its flower the first time, so come back to it. Visit every pad to clear the pond.',
  },
  vanes: {
    title: 'Weathervanes',
    body: 'Tap a vane to turn it. Each vane points at the nearest vane that way. Every vane must point at another one and get wind from just one. Two vanes may not point at each other. Then the wind goes round in loops.',
  },
  binairo: {
    title: 'Twos',
    body: 'Tap a square to fill it with a square or a circle. Never put three the same in a row. Every row and column has the same number of each.',
  },
  arukone: {
    title: 'Twinpath',
    body: 'Drag from a number to the matching number to join them. The board is a mirror: draw on one side and the other side copies it. Paths cannot cross, and every square must be filled.',
  },
  glass: {
    title: 'Stained Glass',
    body: 'Pick a colour, then tap or drag over the glass. Pieces that touch cannot be the same colour. Colour every piece to finish the window.',
  },
  lightsout: {
    title: 'Lanterns',
    body: 'Tap a lantern. It switches, and so do the lanterns right above, below, left and right of it. Turn them all off to win.',
  },
  adjacent: {
    title: 'Adjacent',
    body: 'Tap a tile that touches the same colour. The whole group disappears and the tiles above fall down. Bigger groups score more. Reach the target score to win.',
  },
  bloom: {
    title: 'Bloom',
    body: 'Tap a tile to turn it. Every line must join another line, with no loose ends. Tiles with a gold dot never turn. A loop that closes fills with colour. Close them all to win.',
  },
  bridges: {
    title: 'Bridges',
    body: 'Drag from one island to another to build a bridge. The number says how many bridges an island needs. Bridges cannot cross. When every island turns green, you win.',
  },
  mosaic: {
    title: 'Mosaic',
    body: 'Drag the pieces into the picture. Tap a piece to turn it. Fill every square to finish. Start with the small gaps.',
  },
};

const MECHANIC_INTROS: Record<MechanicTutorialId, TutorialCopy> = {
  obstacles: {
    title: 'Obstacles',
    body: 'Blocks are solid. A ball stops when it hits one.',
  },
  anchored: {
    title: 'Fixed balls',
    body: 'This ball never moves. Other balls stop when they hit it, just like a wall.',
  },
  portals: {
    title: 'Portals',
    body: 'Roll a ball into a ring and it comes out of the matching ring, still rolling the same way.',
  },
  'gravity-zone': {
    title: 'Gravity zone',
    body: 'Inside the coloured area, balls always roll the way the arrows point, whichever way you swipe.',
  },
  hazard: {
    title: 'Hazard',
    body: 'Careful! A ball that rolls onto this breaks, and you have to try again.',
  },
  sand: {
    title: 'Soft sand',
    body: 'A ball that rolls onto sand stops there. Swipe again and it rolls on.',
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
  if (level.sand && level.sand.length > 0) mechanics.push('sand');
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
