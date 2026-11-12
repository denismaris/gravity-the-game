export type { FolioFold, FolioInk, FolioLayer, FolioPuzzle, FolioSheet, FolioSquare, FolioState, FolioTarget } from './types';
export { FOLIO_INKS } from './types';
export { applyFold, creasesOf, downInk, flatSheet, foldingSide, foldSheet, initialFolioState, isCrease, isFolioSolved, isPastTarget, matchesTarget, sheetOf, topInks, underInks, upInk } from './logic';
export { assertValidFolio, parFor, shortestFolds, solveFolio } from './solver';
export { generateFolio, shapeForDifficulty } from './generator';
export type { FolioShape } from './generator';
export { FOLIO, folioCuratedInfo, getFolioByDifficulty, getFolioById } from './puzzles';
export type { FolioEntry } from './puzzles';
export { describeFold, explainFolioHint } from './explain';
