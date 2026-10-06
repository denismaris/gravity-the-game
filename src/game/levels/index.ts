export { createDemoLevel, demoLevel } from './demoLevel';
export type { Difficulty, LevelDefinition, LevelMetadata, StarThresholds } from './level';
export { assertValidLevel, createGameStateFromLevel } from './level';
export {
  GRAVITY_DEPTH_BANDS,
  LEVELS,
  getGravityLevelsForTier,
  gravityTierOf,
  getLevelById,
  getLevelByOrder,
  getLevelsByDifficulty,
  getStarThresholds,
} from './levelData';
