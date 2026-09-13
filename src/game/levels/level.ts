import { GridPosition } from '../models';
import type { GameState, GravityZone, MovableObject, PortalPair } from '../engine/types';
import { ALL_DIRECTIONS, StaticCellType } from '../engine/types';

/** A portal link in level data: exactly two distinct board cells. */
export type LevelPortal = readonly [GridPosition, GridPosition];

/** A gravity zone in level data - same shape the engine uses at runtime. */
export type LevelZone = GravityZone;

/**
 * Coarse difficulty bucket used for grouping/filtering levels in the level
 * select screen. This intentionally does NOT try to capture exact
 * difficulty (that's what `metadata.minMoves` / tags are for) - it just
 * mirrors the broad progression tiers used when hand-authoring levels.
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Per-level move-count thresholds for the three-star mastery system.
 *
 * Every completed level is worth at least one star. `two` / `three` are the
 * *inclusive* upper bounds on gravity moves for the second and third star:
 * solve in `<= three` moves for three stars, `<= two` for two, anything more
 * (but still solved) for one. `three` is always `<= two`, and never below the
 * level's shortest known solution (`minMoves`) - you cannot out-score the
 * optimal path. Thresholds are deliberately per-level (a 1-move puzzle and a
 * 5-move puzzle need very different curves), never one global rule.
 */
export interface StarThresholds {
  /** Max moves for the second star (inclusive). */
  readonly two: number;
  /** Max moves for the third star (inclusive). Always `<= two`. */
  readonly three: number;
}

export interface LevelMetadata {
  /** Length (in gravity moves) of the shortest known solution. Used to
   * sanity-check that a level isn't trivially easier or harder than
   * intended - see `src/game/engine/solver.ts` and the level test suite. */
  readonly minMoves?: number;
  /** Move-count thresholds for the 2nd and 3rd star on this level. Stored
   * with the level data so every level defines its own mastery curve. */
  readonly stars?: StarThresholds;
  /** Free-form labels for filtering/search, e.g. 'obstacles', 'planning'. */
  readonly tags?: ReadonlyArray<string>;
  /** Design notes for whoever is authoring/tuning this level. */
  readonly notes?: string;
}

/**
 * A single hand-authored (or, later, procedurally generated) puzzle.
 *
 * This is plain data - no functions, no React, no engine state - so it can
 * be serialized to/from JSON as-is. That's the whole point: the game
 * should be able to scale from 20 hand-authored levels to thousands of
 * generated ones without changing this shape.
 */
export interface LevelDefinition {
  /** Stable unique identifier, e.g. "level-001". Never reuse or renumber. */
  readonly id: string;
  /** 1-based position in the default play order. */
  readonly order: number;
  /** Short human-readable title shown in the level select screen. */
  readonly name: string;
  /** Board is always square: `rows === cols`. */
  readonly rows: number;
  readonly cols: number;
  /** Starting positions of every normal (gravity-moved) object. */
  readonly objects: ReadonlyArray<GridPosition>;
  /** Target positions. Must be the same length as `objects` (anchored
   * objects are NOT counted) - see `assertValidLevel`. A level is solved
   * when the set of final normal-object positions exactly equals this set
   * (matching is not by identity/order, see `isPuzzleSolved`). */
  readonly targets: ReadonlyArray<GridPosition>;
  readonly obstacles: ReadonlyArray<GridPosition>;
  /**
   * Positions of anchored objects: pieces that gravity never moves and that
   * every normal object collides with like an obstacle. Optional - a level
   * without this field has no anchored objects and behaves exactly as
   * before. Anchored objects never sit on a target, an obstacle, another
   * anchor, or a normal object's start cell (all rejected by
   * `assertValidLevel`).
   */
  readonly anchors?: ReadonlyArray<GridPosition>;
  /**
   * Portal links: each entry is a pair of distinct cells. An object sliding
   * onto either cell is teleported to the other and keeps moving in the
   * current gravity direction. Optional. Endpoints never coincide with an
   * obstacle, a target, an anchor, or another portal endpoint (all rejected
   * by `assertValidLevel`).
   */
  readonly portals?: ReadonlyArray<LevelPortal>;
  /**
   * A single gravity zone: a rectangle (inclusive bounds) inside which
   * gravity always pulls in `direction`, whatever the player pressed.
   * Optional - a level without it plays exactly as before. The rectangle
   * must be in bounds and well-formed; it may freely overlap obstacles,
   * targets and object starts (the zone is a property of cells, not a
   * blocker).
   */
  readonly zone?: LevelZone;
  /**
   * Positions of hazard cells: stepping onto one destroys the object that
   * does, instantly failing the puzzle (see `isPuzzleFailed`). Optional - a
   * level without this field has no hazards and behaves exactly as before.
   * Unlike an obstacle a hazard never blocks entry, so it never shares a
   * cell with anything an object could otherwise reach or rest on: not an
   * object's start, a target, an obstacle, an anchor, another hazard, or a
   * portal endpoint (all rejected by `assertValidLevel`).
   */
  readonly hazards?: ReadonlyArray<GridPosition>;
  readonly difficulty: Difficulty;
  readonly metadata?: LevelMetadata;
}

/**
 * Validates the structural invariants of a level definition. Hand-authored
 * level data is easy to typo (off-by-one coordinates, mismatched object/
 * target counts, overlapping elements) - this catches those mistakes
 * loudly instead of producing a silently-unsolvable or nonsensical board.
 *
 * An object MAY start exactly on its own target (that object is already
 * "solved" from move zero) - this is intentional and common in puzzles
 * where only some pieces need to move. What's never allowed is two
 * objects on the same cell, two targets on the same cell, or an obstacle
 * sharing a cell with anything else.
 *
 * Throws a descriptive `Error` on the first problem found.
 */
export function assertValidLevel(level: LevelDefinition): void {
  if (level.rows <= 0 || level.cols <= 0) {
    throw new Error(`Level ${level.id}: rows/cols must be positive.`);
  }

  if (level.objects.length === 0) {
    throw new Error(`Level ${level.id}: must have at least one movable object.`);
  }

  if (level.objects.length !== level.targets.length) {
    throw new Error(
      `Level ${level.id}: ${level.objects.length} object(s) but ${level.targets.length} target(s) - counts must match.`,
    );
  }

  const keyOf = (position: GridPosition): string => `${position.row}:${position.col}`;

  const checkBounds = (label: string, position: GridPosition): void => {
    const { row, col } = position;
    if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) {
      throw new Error(
        `Level ${level.id}: ${label} at (${row}, ${col}) is outside the ${level.rows}x${level.cols} board.`,
      );
    }
  };

  const anchors = level.anchors ?? [];
  const portals = level.portals ?? [];
  const hazards = level.hazards ?? [];

  level.objects.forEach(position => checkBounds('object', position));
  level.targets.forEach(position => checkBounds('target', position));
  level.obstacles.forEach(position => checkBounds('obstacle', position));
  anchors.forEach(position => checkBounds('anchor', position));
  portals.forEach(pair => pair.forEach(position => checkBounds('portal endpoint', position)));
  hazards.forEach(position => checkBounds('hazard', position));

  const objectKeys = new Set(level.objects.map(keyOf));
  if (objectKeys.size !== level.objects.length) {
    throw new Error(`Level ${level.id}: two objects overlap each other.`);
  }

  const targetKeys = new Set(level.targets.map(keyOf));
  if (targetKeys.size !== level.targets.length) {
    throw new Error(`Level ${level.id}: two targets overlap each other.`);
  }

  const obstacleKeys = new Set(level.obstacles.map(keyOf));
  if (obstacleKeys.size !== level.obstacles.length) {
    throw new Error(`Level ${level.id}: two obstacles overlap each other.`);
  }

  const anchorKeys = new Set(anchors.map(keyOf));
  if (anchorKeys.size !== anchors.length) {
    throw new Error(`Level ${level.id}: two anchored objects overlap each other.`);
  }

  const hazardKeys = new Set(hazards.map(keyOf));
  if (hazardKeys.size !== hazards.length) {
    throw new Error(`Level ${level.id}: two hazards overlap each other.`);
  }

  for (const key of obstacleKeys) {
    if (objectKeys.has(key)) {
      throw new Error(`Level ${level.id}: an obstacle overlaps an object at (${key}).`);
    }
    if (targetKeys.has(key)) {
      throw new Error(`Level ${level.id}: an obstacle overlaps a target at (${key}).`);
    }
  }

  // Anchored objects are permanent blockers, so they must not share a cell
  // with anything: a normal object's start, a target (which then could never
  // be covered), an obstacle, or another anchor.
  for (const key of anchorKeys) {
    if (objectKeys.has(key)) {
      throw new Error(`Level ${level.id}: an anchored object overlaps a normal object at (${key}).`);
    }
    if (targetKeys.has(key)) {
      throw new Error(`Level ${level.id}: an anchored object sits on a target at (${key}) - it could never be covered.`);
    }
    if (obstacleKeys.has(key)) {
      throw new Error(`Level ${level.id}: an anchored object overlaps an obstacle at (${key}).`);
    }
  }

  // A hazard is lethal the instant an object reaches it, so - unlike an
  // obstacle - it must never share a cell with anything an object could
  // otherwise legitimately occupy: an object could never start already dead,
  // a target could never be safely covered, and an obstacle/anchor there
  // would be redundant (nothing could ever reach the hazard anyway).
  for (const key of hazardKeys) {
    if (objectKeys.has(key)) {
      throw new Error(`Level ${level.id}: a hazard overlaps an object's start position at (${key}) - it would start destroyed.`);
    }
    if (targetKeys.has(key)) {
      throw new Error(`Level ${level.id}: a hazard overlaps a target at (${key}) - it could never be safely covered.`);
    }
    if (obstacleKeys.has(key)) {
      throw new Error(`Level ${level.id}: a hazard overlaps an obstacle at (${key}).`);
    }
    if (anchorKeys.has(key)) {
      throw new Error(`Level ${level.id}: a hazard overlaps an anchored object at (${key}).`);
    }
  }

  // A portal endpoint must be a plain cell that an object can slide onto: not
  // an obstacle/target/anchor (which would break traversal or the win
  // check), not another portal endpoint (a cell links to exactly one place),
  // and the two ends of a pair must be different cells. Starting an object on
  // a portal endpoint is allowed - on the first move it just slides off.
  const portalKeys = new Set<string>();
  for (const pair of portals) {
    if (pair.length !== 2) {
      throw new Error(`Level ${level.id}: a portal must link exactly two cells.`);
    }
    const [a, b] = pair;
    if (keyOf(a) === keyOf(b)) {
      throw new Error(`Level ${level.id}: a portal links a cell (${keyOf(a)}) to itself.`);
    }
    for (const key of [keyOf(a), keyOf(b)]) {
      if (portalKeys.has(key)) {
        throw new Error(`Level ${level.id}: cell (${key}) is used by more than one portal endpoint.`);
      }
      portalKeys.add(key);
      if (obstacleKeys.has(key)) {
        throw new Error(`Level ${level.id}: a portal endpoint overlaps an obstacle at (${key}).`);
      }
      if (targetKeys.has(key)) {
        throw new Error(`Level ${level.id}: a portal endpoint overlaps a target at (${key}).`);
      }
      if (anchorKeys.has(key)) {
        throw new Error(`Level ${level.id}: a portal endpoint overlaps an anchored object at (${key}).`);
      }
      if (hazardKeys.has(key)) {
        throw new Error(`Level ${level.id}: a portal endpoint overlaps a hazard at (${key}).`);
      }
    }
  }

  // The gravity zone is a well-formed rectangle inside the board. It is a
  // property of the cells it covers, so it may overlap anything else.
  if (level.zone) {
    const { minRow, maxRow, minCol, maxCol, direction } = level.zone;
    if (minRow > maxRow || minCol > maxCol) {
      throw new Error(`Level ${level.id}: gravity zone bounds are inverted.`);
    }
    if (
      minRow < 0 ||
      maxRow >= level.rows ||
      minCol < 0 ||
      maxCol >= level.cols
    ) {
      throw new Error(`Level ${level.id}: gravity zone extends outside the ${level.rows}x${level.cols} board.`);
    }
    if (!ALL_DIRECTIONS.includes(direction)) {
      throw new Error(`Level ${level.id}: gravity zone direction "${direction}" is not a valid direction.`);
    }
  }

  const stars = level.metadata?.stars;
  if (stars) {
    const minMoves = level.metadata?.minMoves;
    if (stars.three < 1 || stars.two < 1) {
      throw new Error(`Level ${level.id}: star thresholds must be positive move counts.`);
    }
    if (stars.two < stars.three) {
      throw new Error(
        `Level ${level.id}: 2-star threshold (${stars.two}) must be >= 3-star threshold (${stars.three}).`,
      );
    }
    if (minMoves !== undefined && stars.three < minMoves) {
      throw new Error(
        `Level ${level.id}: 3-star threshold (${stars.three}) is below the shortest solution (${minMoves}).`,
      );
    }
  }
}

/**
 * Converts a `LevelDefinition` into a runtime `GameState` ready to hand to
 * the gravity engine. Validates the level first so authoring mistakes fail
 * fast with a clear message rather than producing a broken board.
 *
 * Built directly (rather than routed through the `Board`/`CellType` model)
 * because that model can only hold one "type" per cell, which cannot
 * represent an object that legitimately starts on top of its own target.
 */
export function createGameStateFromLevel(level: LevelDefinition): GameState {
  assertValidLevel(level);

  const staticGrid: StaticCellType[][] = Array.from({ length: level.rows }, () =>
    Array.from({ length: level.cols }, () => StaticCellType.Empty),
  );

  for (const { row, col } of level.targets) {
    staticGrid[row][col] = StaticCellType.Target;
  }
  for (const { row, col } of level.obstacles) {
    staticGrid[row][col] = StaticCellType.Obstacle;
  }
  for (const { row, col } of level.hazards ?? []) {
    staticGrid[row][col] = StaticCellType.Hazard;
  }

  const movables: MovableObject[] = [
    ...level.objects.map((position, index) => ({
      id: `${level.id}-object-${index}`,
      row: position.row,
      col: position.col,
    })),
    ...(level.anchors ?? []).map((position, index) => ({
      id: `${level.id}-anchor-${index}`,
      row: position.row,
      col: position.col,
      anchored: true as const,
    })),
  ];

  const portals: PortalPair[] = (level.portals ?? []).map(([a, b]) => [
    { row: a.row, col: a.col },
    { row: b.row, col: b.col },
  ]);

  return {
    rows: level.rows,
    cols: level.cols,
    staticGrid,
    movables,
    portals,
    zone: level.zone ? { ...level.zone } : null,
  };
}
