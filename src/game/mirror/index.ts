export type { Direction, MirrorKind, MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState } from './types';
export {
  emptyMirrorMazeState,
  isEligible,
  isMirrorMazeSolved,
  nextMirror,
  reflect,
  remainingGems,
  setMirror,
  traceAll,
  traceBeam,
  traceBeams,
} from './logic';
export type { BeamPiece, BeamTrace } from './logic';
export { assertValidMirrorMaze, revealHint, solveMirrorMaze } from './solver';
export { getMirrorMazeById, getMirrorMazesByDifficulty, MIRROR_MAZES } from './puzzles';
export { explainMirrorHint } from './explain';
