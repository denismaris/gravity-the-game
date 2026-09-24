export type { Direction, MirrorKind, MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState } from './types';
export {
  emptyMirrorMazeState,
  isEligible,
  isMirrorMazeSolved,
  nextMirror,
  reflect,
  remainingGems,
  setMirror,
  traceBeam,
} from './logic';
export { assertValidMirrorMaze, revealHint, solveMirrorMaze } from './solver';
export { getMirrorMazeById, getMirrorMazesByDifficulty, MIRROR_MAZES } from './puzzles';
