import { GameKind } from './gameKind';

/**
 * Each game's whole rule, in one or two plain sentences: what a player
 * glances at mid-board when they have forgotten it (tap the game's name in
 * its header), short of reopening the full How to play.
 */
export const GAME_RULES: Record<GameKind, string> = {
  binairo: 'Fill every square with a circle or a square. Never three alike in a line, and each row and column holds as many of one as of the other.',
  lightsout: 'Tapping a lantern switches it and the lanterns beside it. Put every lantern out.',
  glass: 'Colour every piece of the window. Pieces that touch must be different colours.',
  mirror: 'Tilt the mirrors so the light passes through every gem and ends on the gold ring.',
  bloom: 'Turn the tiles until every line joins up into closed loops.',
  vanes: 'Each vane points at the nearest vane that way. Turn them so the wind runs through every vane, and no two point at each other.',
  adjacent: 'Tap a group of two or more matching tiles to clear it. Bigger groups score more. Reach the target score.',
  bridges: 'Join the islands with straight bridges. Each island needs as many bridges as its number, and bridges never cross.',
  arukone: 'Join each pair of matching numbers with a path, and fill every square. The board is a mirror: each path draws its twin.',
  mosaic: 'Fill the picture with the pieces from the tray. Tap a piece to turn it, then drag it in.',
  lilypads: 'The frog jumps to the nearest pad up, down, left or right. A pad sinks when the frog leaves it. Visit every pad.',
  gravity: 'Swipe and every ball rolls until something stops it. Put a ball on every ring.',
};
