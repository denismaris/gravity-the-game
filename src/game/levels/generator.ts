import { applyGravity } from '../engine/gravity';
import { findShortestSolution } from '../engine/solver';
import { Direction } from '../engine/types';
import { endlessSeed } from '../endlessId';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { GridPosition } from '../models';
import { assertValidLevel, createGameStateFromLevel, LevelDefinition } from './level';

/* eslint-disable no-bitwise -- mulberry32 is bitwise by definition */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

interface GravityShape {
  readonly sizes: ReadonlyArray<number>;
  readonly objects: readonly [number, number];
  readonly obstacles: readonly [number, number];
  readonly anchors: readonly [number, number];
  readonly hazards: readonly [number, number];
  /** Shortest solution, in moves - the same depth bands the dealer deals
   * the curated levels by (`GRAVITY_DEPTH_BANDS`). */
  readonly depth: readonly [number, number];
  /** Moves over the shortest that still earn two stars. */
  readonly slack: number;
}

const SHAPES: Record<PuzzleDifficulty, GravityShape> = {
  easy: { sizes: [5, 6], objects: [1, 1], obstacles: [4, 7], anchors: [0, 0], hazards: [0, 1], depth: [3, 4], slack: 2 },
  medium: { sizes: [6], objects: [1, 2], obstacles: [5, 8], anchors: [0, 1], hazards: [0, 1], depth: [5, 7], slack: 3 },
  hard: { sizes: [7], objects: [2, 3], obstacles: [6, 10], anchors: [0, 2], hazards: [0, 2], depth: [8, 12], slack: 4 },
};

/**
 * An endless Gravity board, found the way World 7 and World 8 were: a
 * random board - pieces, targets, obstacles, now and then an anchor or a
 * hazard - kept only if its shortest solution (proved by breadth-first
 * search, `findShortestSolution`) lands in the tier's depth band. Stars are
 * set from that proof: three for the shortest, two within the tier's slack.
 */
/**
 * What a later board brings: soft sand, which stops whatever slides onto
 * it. `balls` overrides the tier's count of balls; `depth` its band.
 */
export interface GravityRules {
  readonly sand?: number;
  readonly balls?: readonly [number, number];
  readonly depth?: readonly [number, number];
}

/** What an endless board brings, from its own stream so a plain board is
 * dealt exactly as it always was: medium and hard often have sand. */
function endlessRules(id: string, tier: PuzzleDifficulty): GravityRules {
  const roll = mulberry32(endlessSeed(`${id}:rules`))();
  if (tier === 'medium' && roll < 0.4) return { sand: 2 };
  if (tier === 'hard' && roll < 0.45) return { sand: roll < 0.2 ? 3 : 2 };
  return {};
}

export function generateGravityLevel(id: string, name: string, tier: PuzzleDifficulty, rules: GravityRules = endlessRules(id, tier)): LevelDefinition {
  const shape = { ...SHAPES[tier], ...(rules.balls ? { objects: rules.balls } : {}), ...(rules.depth ? { depth: rules.depth } : {}) };
  const random = mulberry32(endlessSeed(id));
  const between = ([lo, hi]: readonly [number, number]) => lo + Math.floor(random() * (hi - lo + 1));
  let fallback: { level: LevelDefinition; moves: number } | null = null;

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const size = shape.sizes[Math.floor(random() * shape.sizes.length)];
    const used = new Set<string>();
    const cell = (): GridPosition | null => {
      for (let t = 0; t < 60; t += 1) {
        const p = { row: Math.floor(random() * size), col: Math.floor(random() * size) };
        const key = `${p.row}:${p.col}`;
        if (!used.has(key)) {
          used.add(key);
          return p;
        }
      }
      return null;
    };
    const list = (n: number): GridPosition[] => Array.from({ length: n }, cell).filter((p): p is GridPosition => p !== null);
    const objectCount = between(shape.objects);
    const objects = list(objectCount);
    const targets = list(objectCount);
    const obstacles = list(between(shape.obstacles));
    const anchors = list(between(shape.anchors));
    const hazards = list(between(shape.hazards));
    const sand = rules.sand ? list(rules.sand) : [];
    const draft: LevelDefinition = {
      id,
      order: 0,
      name,
      rows: size,
      cols: size,
      objects,
      targets,
      obstacles,
      anchors,
      hazards,
      ...(sand.length ? { sand } : {}),
      difficulty: tier,
    };
    try {
      assertValidLevel(draft);
    } catch {
      continue;
    }
    const path = findShortestSolution(createGameStateFromLevel(draft), shape.depth[1]);
    if (!path) continue;
    const moves = path.length;
    if (rules.sand && !sandMatters(draft, path, shape.depth[1])) continue;
    const level: LevelDefinition = { ...draft, metadata: { minMoves: moves, stars: { three: moves, two: moves + shape.slack }, tags: ['endless'] } };
    if (moves >= shape.depth[0]) return level;
    // A sand board is never dealt shallow: its depth is the point of it.
    if (rules.sand) continue;
    if (!fallback || moves > fallback.moves) fallback = { level, moves };
  }
  if (fallback) return fallback.level;
  throw new Error(`Gravity ${id}: no board found`);
}

/**
 * Whether a board's sand earns its place - not merely there, but the heart
 * of the board: without it the board cannot be solved at all, and the way
 * through uses it more than once (two stops on sand, or two sand squares),
 * so the sand is something to plan with, not a square to roll past.
 */
function sandMatters(level: LevelDefinition, path: ReadonlyArray<Direction>, depth: number): boolean {
  if (findShortestSolution(createGameStateFromLevel({ ...level, sand: [] }), depth + 2) !== null) return false;
  const sandKeys = new Set((level.sand ?? []).map(c => `${c.row}:${c.col}`));
  let state = createGameStateFromLevel(level);
  let stops = 0;
  const squares = new Set<string>();
  for (const direction of path) {
    const next = applyGravity(state, direction);
    next.movables.forEach((m, i) => {
      const key = `${m.row}:${m.col}`;
      const moved = m.row !== state.movables[i].row || m.col !== state.movables[i].col;
      if (moved && sandKeys.has(key)) {
        stops += 1;
        squares.add(key);
      }
    });
    state = next;
  }
  return stops >= 2 || squares.size >= 2;
}
