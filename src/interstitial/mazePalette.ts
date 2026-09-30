import { getColorScheme, theme } from '../theme';

/**
 * The break's maze, in the app's own paper palette.
 *
 * It used to be a near-black channel with a pewter ball, measured off an
 * outside reference - crisp, but it read as a different app dropped in
 * between two puzzles. Now the maze is a channel carved into a paper slab
 * like every other board's plinth, the floor the warm sand of a Mosaic
 * socket, and the paint the same glaze family as the tiles elsewhere.
 * Depth is geometry only: the slab stands on an offset side face, and the
 * channel's far wall shows as a flat band - no gradients.
 *
 * By night the same slab is lamp-lit card on a dark desk: the channel is
 * cut into dusk-violet stone, the walls step down in the same three bands,
 * and the paint glows against it instead of sitting on sand.
 */
const DAY = {
  slabSide: '#D3C29B',
  socket: '#E6D8B6',
  socketSeam: '#D9C9A3',
  wallFace: '#C9B78E',
  wallLip: '#DCCDA8',
  wallFoot: '#B9A67C',
};
const NIGHT: typeof DAY = {
  slabSide: '#0E0A12',
  socket: '#1A1420',
  socketSeam: '#241C2B',
  wallFace: '#3B2F47',
  wallLip: '#4C3E59',
  wallFoot: '#2B2235',
};
const tones = (): typeof DAY => (getColorScheme() === 'dark' ? NIGHT : DAY);

/** The maze's colours, read live - so the break draws in whichever palette
 * is on. */
export const mazeColors = {
  get slab(): string {
    return theme.colors.surfaceHi;
  },
  get slabSide(): string {
    return tones().slabSide;
  },
  get socket(): string {
    return tones().socket;
  },
  get socketSeam(): string {
    return tones().socketSeam;
  },
  get wallFace(): string {
    return tones().wallFace;
  },
  get wallLip(): string {
    return tones().wallLip;
  },
  get wallFoot(): string {
    return tones().wallFoot;
  },
  /** Violet ink by day, like the app's type: dark enough to read on the
   * sand floor and on every paint colour. Parchment by night. */
  get ball(): string {
    return theme.colors.primary;
  },
};

/** Paint colours, one per maze, each [lip, glaze, deep] - the lip lights
 * a painted square's top edge, the deep tone is the splash on a wall hit.
 * Mid-saturation glazes, the family of the app's tiles, rather than the
 * old neon set that only worked on black. */
export const MAZE_PAINTS: ReadonlyArray<readonly [string, string, string]> = [
  ['#F6C4A2', '#E08A5A', '#A5552A'],
  ['#AFDAE0', '#4E9AA6', '#2C6570'],
  ['#CFE3B8', '#86AE68', '#4F7438'],
  // Periwinkle, not plum: a plum trail sat too close to the violet ball.
  ['#CDD7F4', '#7D93D8', '#46589C'],
  ['#F3DDA2', '#D7A844', '#8E6A1C'],
  ['#F5C9D1', '#D9788A', '#98465A'],
];
