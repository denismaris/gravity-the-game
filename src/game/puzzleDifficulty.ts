/**
 * The one difficulty vocabulary shared by every puzzle game in this app,
 * for the batch generator (`src/progression/batches.ts`) to query "give me
 * an easy Mirror Maze puzzle" or "a hard Towers puzzle" against a common
 * scale. Deliberately just three tiers, even for Gravity - which has its
 * own richer `Difficulty` type (`'easy' | 'medium' | 'hard' | 'expert'` in
 * `src/game/levels/level.ts`) - the batch generator maps Gravity's own
 * `expert` levels to nothing at all (never queries them), rather than
 * stretching this shared type to a fourth tier just for one game. A
 * neutral, standalone module (not re-exported from any one game's own
 * `types.ts`) so that every game can depend on this one shared vocabulary
 * without any game becoming a compile-time dependency of another.
 */
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';
