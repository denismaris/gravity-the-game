import { LevelDefinition, StarThresholds } from './level';

/**
 * The hand-authored levels, in play order. Levels 1-20 are World 1
 * (Gravity); levels 21-30 are World 2 (Anchors) - see `src/game/worlds`.
 *
 * This is the canonical example of the data-driven level format: nothing
 * here is generated or computed - it is plain, serializable data using
 * only mechanics that exist in the engine (gravity, static obstacles,
 * multiple objects, targets, and - from level 21 - anchored objects). The
 * same shape (`LevelDefinition`) is meant to scale to thousands of levels
 * later, whether hand-authored or produced by a procedural generator (not
 * built yet).
 *
 * Progression:
 *  - 1-5:   very easy - teaches the basic mechanic (all four directions,
 *           and combining two directions), zero obstacles.
 *  - 6-10:  introduces obstacles and positioning - using an obstacle as a
 *           stop, a wall, or an alignment tool before dropping.
 *  - 11-15: multiple objects and more complex sequences - objects that
 *           block/stack on each other, combined with obstacles.
 *  - 16-20: requires planning several gravity changes ahead - detours,
 *           "move this piece out of the way first", ending on the hardest
 *           puzzle in World 1.
 *  - 21-23: teach ANCHORED OBJECTS - a piece gravity never moves, which
 *           every normal object collides with like a wall.
 *  - 24-26: combine anchors with obstacles (two kinds of fixed blocker).
 *  - 27-30: plan several moves around multiple anchors, ending on the
 *           hardest puzzle in World 2.
 *
 * `metadata.minMoves` records the length of the shortest solution found by
 * the BFS solver (`src/game/engine/solver.ts`) at authoring time. Tests in
 * `levels.test.ts` re-run the solver against every level and fail if a
 * level is unsolvable, already solved at the start, or its shortest
 * solution no longer matches `minMoves` (a regression signal).
 *
 * `metadata.stars` gives each level its own three-star curve (see
 * `StarThresholds`): `three` is the move count for a 3rd star (always the
 * optimal `minMoves` here - you cannot out-score the shortest path), `two`
 * the 2nd star. The slack between `minMoves` and `two` widens with tier
 * (+2 for the teaching tiers, +3 for the planning tiers, +4 for the
 * finale) so "solved but inefficiently" reliably lands on one star.
 */
export const LEVELS: ReadonlyArray<LevelDefinition> = [
  // ======================================================================
  // Tier 1 (levels 1-5): very easy - teach the basic mechanic.
  // No obstacles at all. Each level introduces one new idea about how
  // gravity works, one at a time.
  // ======================================================================
  {
    id: 'level-001',
    order: 1,
    name: 'First Drop',
    rows: 5,
    cols: 5,
    objects: [{ row: 0, col: 2 }],
    targets: [{ row: 4, col: 2 }],
    obstacles: [],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['tutorial'], notes: 'Teaches: pressing a direction drops the object all the way to the edge.' },
  },
  {
    id: 'level-002',
    order: 2,
    name: 'Slide Over',
    rows: 5,
    cols: 5,
    objects: [{ row: 2, col: 0 }],
    targets: [{ row: 2, col: 4 }],
    obstacles: [],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['tutorial'], notes: 'Teaches: gravity can point sideways (right), not just down.' },
  },
  {
    id: 'level-003',
    order: 3,
    name: 'Rise Up',
    rows: 5,
    cols: 5,
    objects: [{ row: 4, col: 2 }],
    targets: [{ row: 0, col: 2 }],
    obstacles: [],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['tutorial'], notes: "Teaches: gravity can point 'up' too - all four directions exist." },
  },
  {
    id: 'level-004',
    order: 4,
    name: 'Corner to Corner',
    rows: 5,
    cols: 5,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 4, col: 4 }],
    obstacles: [],
    difficulty: 'easy',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['tutorial'], notes: 'Teaches: combining two directions in sequence (down, then right).' },
  },
  {
    id: 'level-005',
    order: 5,
    name: 'Up and Over',
    rows: 5,
    cols: 5,
    objects: [{ row: 4, col: 4 }],
    targets: [{ row: 0, col: 0 }],
    obstacles: [],
    difficulty: 'easy',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['tutorial'], notes: 'Same idea as level 4, mirrored, using up+left - confirms the lesson generalizes.' },
  },

  // ======================================================================
  // Tier 2 (levels 6-10): introduce obstacles and positioning.
  // Every level here has exactly one movable object; the challenge is
  // reading how an obstacle changes where gravity will stop it.
  // ======================================================================
  {
    id: 'level-006',
    order: 6,
    name: 'Soft Landing',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 2 }],
    targets: [{ row: 3, col: 2 }],
    obstacles: [{ row: 4, col: 2 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['obstacles'], notes: 'Teaches: an obstacle can stop an object short of the board edge.' },
  },
  {
    id: 'level-007',
    order: 7,
    name: 'Wall Stop',
    rows: 6,
    cols: 6,
    objects: [{ row: 3, col: 0 }],
    targets: [{ row: 3, col: 4 }],
    obstacles: [{ row: 3, col: 5 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['obstacles'], notes: 'Same idea, sideways - the target is one cell short of the true wall.' },
  },
  {
    id: 'level-008',
    order: 8,
    name: 'Under and Across',
    rows: 6,
    cols: 6,
    objects: [{ row: 5, col: 1 }],
    targets: [{ row: 2, col: 4 }],
    obstacles: [{ row: 1, col: 1 }, { row: 2, col: 5 }],
    difficulty: 'medium',
    metadata: {
      minMoves: 2,
      stars: { two: 4, three: 2 },
      tags: ['obstacles', 'positioning'],
      notes:
        'First tier-2 level that needs two moves: rise until an obstacle stops ' +
        'you at a row, then slide across into the far obstacle. Complements ' +
        'level 9 (stop across first, then drop) rather than repeating levels ' +
        '6-7 a third time with a single-move obstacle stop.',
    },
  },
  {
    id: 'level-009',
    order: 9,
    name: 'Threading the Needle',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 5, col: 2 }],
    obstacles: [{ row: 0, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['obstacles', 'positioning'], notes: 'Positioning lesson: slide right until the wall stops you exactly above the target column, then drop.' },
  },
  {
    id: 'level-010',
    order: 10,
    name: 'Two Turns',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 1 }],
    targets: [{ row: 3, col: 3 }],
    obstacles: [{ row: 0, col: 4 }, { row: 4, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['obstacles', 'positioning'], notes: 'Two obstacles, two roles: one aligns the column, the other sets the final depth.' },
  },

  // ======================================================================
  // Tier 3 (levels 11-15): multiple objects and more complex sequences.
  // Objects now block, stack on, and depend on each other.
  // ======================================================================
  {
    id: 'level-011',
    order: 11,
    name: 'Two of a Kind',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 5 }],
    targets: [{ row: 6, col: 1 }, { row: 6, col: 5 }],
    obstacles: [],
    difficulty: 'medium',
    metadata: { minMoves: 1, stars: { two: 4, three: 1 }, tags: ['multi-object'], notes: 'Teaches: one gravity change moves every object on the board at once.' },
  },
  {
    id: 'level-013',
    order: 12,
    name: 'Stack Up',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 2 }, { row: 2, col: 2 }, { row: 0, col: 5 }],
    targets: [{ row: 5, col: 2 }, { row: 6, col: 2 }, { row: 6, col: 5 }],
    obstacles: [],
    difficulty: 'medium',
    metadata: {
      minMoves: 1,
      stars: { two: 4, three: 1 },
      tags: ['multi-object'],
      notes:
        'Placed before "Trading Places" so tier 3 escalates cleanly: first the ' +
        'new idea that objects sharing a column stack on top of each other ' +
        '(still one move), then objects that must collide on purpose (two moves).',
    },
  },
  {
    id: 'level-012',
    order: 13,
    name: 'Trading Places',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 5 }],
    targets: [{ row: 6, col: 5 }, { row: 6, col: 6 }],
    obstacles: [],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 5, three: 2 }, tags: ['multi-object'], notes: 'The two objects end up sharing a row and must slide into each other on purpose.' },
  },
  {
    id: 'level-014',
    order: 14,
    name: 'Two Lanes',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 2 }, { row: 0, col: 4 }],
    targets: [{ row: 6, col: 2 }, { row: 6, col: 6 }],
    obstacles: [{ row: 6, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 5, three: 2 }, tags: ['multi-object', 'obstacles'] },
  },
  {
    id: 'level-015',
    order: 15,
    name: 'Three-Point Landing',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 3 }, { row: 0, col: 5 }],
    targets: [{ row: 6, col: 1 }, { row: 3, col: 3 }, { row: 6, col: 6 }],
    obstacles: [{ row: 4, col: 3 }, { row: 3, col: 4 }, { row: 6, col: 2 }],
    difficulty: 'medium',
    metadata: {
      minMoves: 2,
      stars: { two: 5, three: 2 },
      tags: ['multi-object', 'obstacles'],
      notes:
        'Three objects, three different stopping depths. Deliberately requires a ' +
        'second move (drop, then slide right) so tier 3 ends by easing into tier ' +
        "4's multi-move planning instead of a flat single-move finish.",
    },
  },

  // ======================================================================
  // Tier 4 (levels 16-20): plan several gravity changes ahead.
  // Direct routes are deliberately blocked; the player must sequence
  // moves rather than react to just the next one.
  // ======================================================================
  {
    id: 'level-016',
    order: 16,
    name: 'The Detour',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 4 }],
    targets: [{ row: 7, col: 0 }],
    obstacles: [{ row: 3, col: 4 }, { row: 0, col: 1 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['planning'], notes: 'The direct route down is blocked - drop, detour left, then drop again.' },
  },
  {
    id: 'level-017',
    order: 17,
    name: 'Make Room',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 3 }, { row: 4, col: 3 }],
    targets: [{ row: 7, col: 3 }, { row: 4, col: 7 }],
    obstacles: [{ row: 0, col: 4 }, { row: 5, col: 7 }],
    difficulty: 'hard',
    metadata: { minMoves: 2, stars: { two: 5, three: 2 }, tags: ['planning', 'multi-object'], notes: 'The lower object is in the way - it must move aside before the falling one can pass.' },
  },
  {
    id: 'level-018',
    order: 18,
    name: 'Around the Block',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 0, col: 7 }],
    obstacles: [{ row: 0, col: 3 }, { row: 0, col: 4 }, { row: 0, col: 5 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['planning', 'obstacles'], notes: 'A wall blocks the direct route across the top - go down, across, and back up.' },
  },
  {
    id: 'level-019',
    order: 19,
    name: 'Triple Threat',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 4 }, { row: 0, col: 6 }],
    targets: [{ row: 7, col: 3 }, { row: 4, col: 4 }, { row: 7, col: 7 }],
    obstacles: [{ row: 5, col: 4 }, { row: 7, col: 4 }, { row: 4, col: 5 }],
    difficulty: 'expert',
    metadata: { minMoves: 2, stars: { two: 5, three: 2 }, tags: ['planning', 'multi-object'], notes: 'Three objects with three different obstacle interactions, resolved in one carefully-chosen pair of moves.' },
  },
  {
    id: 'level-020',
    order: 20,
    name: 'The Maze',
    rows: 9,
    cols: 9,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 8, col: 8 }],
    obstacles: [{ row: 3, col: 0 }, { row: 3, col: 4 }, { row: 5, col: 8 }, { row: 5, col: 4 }],
    difficulty: 'expert',
    metadata: { minMoves: 5, stars: { two: 9, three: 5 }, tags: ['planning', 'obstacles'], notes: 'The grand finale of the first 20 levels - the longest required solution in the set.' },
  },

  // ======================================================================
  // WORLD 2 - ANCHORS
  //
  // Tier 5 (levels 21-23): teach anchored objects. One normal object, one
  // anchor. The anchor is a piece that never moves; a normal object stops
  // against it exactly like a wall.
  // ======================================================================
  {
    id: 'level-021',
    order: 21,
    name: 'Held in Place',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 2 }],
    targets: [{ row: 3, col: 2 }],
    obstacles: [],
    anchors: [{ row: 4, col: 2 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors', 'tutorial'], notes: 'Teaches: an anchored object is a fixed blocker - the drop stops on top of it.' },
  },
  {
    id: 'level-022',
    order: 22,
    name: 'Lean On It',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 5, col: 3 }],
    obstacles: [],
    anchors: [{ row: 0, col: 4 }],
    difficulty: 'easy',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'Slide into the anchor to line up the column, then drop - the anchor is an alignment tool, like an obstacle.' },
  },
  {
    id: 'level-023',
    order: 23,
    name: 'Drop and Go',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 3 }],
    targets: [{ row: 3, col: 0 }],
    obstacles: [],
    anchors: [{ row: 4, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'Reverse of level 22: drop onto the anchor first (stopping mid-board), then slide off to the target.' },
  },

  // ======================================================================
  // Tier 6 (levels 24-26): anchors + obstacles. Two kinds of permanent
  // blocker in one puzzle - one sets the column, the other sets the depth.
  // ======================================================================
  {
    id: 'level-024',
    order: 24,
    name: 'Anchor and Wall',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }],
    targets: [{ row: 4, col: 4 }],
    obstacles: [{ row: 0, col: 5 }],
    anchors: [{ row: 5, col: 4 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors', 'obstacles'], notes: 'Obstacle stops the slide to align column 4; the anchor stops the drop one row short of the floor.' },
  },
  {
    id: 'level-025',
    order: 25,
    name: 'The Ledge',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 4, col: 3 }],
    obstacles: [{ row: 5, col: 0 }],
    anchors: [{ row: 4, col: 4 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors', 'obstacles'], notes: 'Mirror of level 24: the obstacle makes a ledge to stop the drop at row 4, the anchor stops the slide at the target.' },
  },
  {
    id: 'level-026',
    order: 26,
    name: 'Two Blockers',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 6, col: 6 }],
    obstacles: [{ row: 0, col: 3 }],
    anchors: [{ row: 3, col: 0 }],
    difficulty: 'medium',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'Both diagonals are blocked (anchor down the left, obstacle across the top); either order works but it takes three moves to reach the far corner.' },
  },

  // ======================================================================
  // Tier 7 (levels 27-30): plan several moves around multiple anchors.
  // Direct routes are pinned shut; the anchors must be gone around.
  // ======================================================================
  {
    id: 'level-027',
    order: 27,
    name: 'The Outside Route',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 4 }],
    targets: [{ row: 7, col: 4 }],
    obstacles: [],
    anchors: [{ row: 3, col: 4 }, { row: 7, col: 5 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'The straight drop to the target is pinned shut by an anchor - go out to the left wall, down, and back in (the second anchor catches the return slide).' },
  },
  {
    id: 'level-028',
    order: 28,
    name: 'Pinned Corners',
    rows: 8,
    cols: 8,
    objects: [{ row: 7, col: 0 }],
    targets: [{ row: 0, col: 6 }],
    obstacles: [{ row: 0, col: 7 }],
    anchors: [{ row: 7, col: 3 }, { row: 3, col: 0 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'One anchor blocks the slide along the floor, the other blocks the climb up the wall - the only way up is the short hop the floor anchor allows first. Obstacle stops the final slide on the target.' },
  },
  {
    id: 'level-029',
    order: 29,
    name: 'Release Forward',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }, { row: 3, col: 0 }],
    targets: [{ row: 7, col: 2 }, { row: 7, col: 7 }],
    obstacles: [],
    anchors: [{ row: 7, col: 3 }],
    difficulty: 'expert',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'Two objects stack in the left column, then the lower one is released rightward into the anchor while the upper one drops behind it and continues to the far corner.' },
  },
  {
    id: 'level-030',
    order: 30,
    name: 'The Gauntlet',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 7 }],
    obstacles: [],
    anchors: [{ row: 0, col: 4 }, { row: 7, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 7 }],
    difficulty: 'expert',
    metadata: { minMoves: 5, stars: { two: 9, three: 5 }, tags: ['anchors', 'planning'], notes: 'Four anchors turn the board into a staircase that has to be climbed down, across, up, across and down - the first genuinely long anchor puzzle before the World 2 expansion (levels 31-60) picks up the thread.' },
  },

  // ======================================================================
  // WORLD 2 EXPANSION (levels 31-60). Same mechanics (gravity, obstacles,
  // multiple objects, targets, anchored objects) - no new mechanic. Each
  // level isolates one idea; move count is NOT the only difficulty axis
  // (the 41-45 band drops back to short solutions on purpose - the new
  // demand there is reading several objects at once).
  //
  // Tier 8  (31-35): trivial gravity + anchor combinations.
  // Tier 9  (36-40): read how an anchor changes where a move ends.
  // Tier 10 (41-45): multiple objects meeting anchored objects.
  // Tier 11 (46-50): plan several gravity changes ahead.
  // Tier 12 (51-55): busier layouts, several anchors that each do a job.
  // Tier 13 (56-60): advanced but fair - everything so far, ending on the
  //                  longest required solution in the game (7 moves).
  // ======================================================================

  // ---- Tier 8 (31-35): trivial combinations ----------------------------
  {
    id: 'level-031',
    order: 31,
    name: 'Sidestop',
    rows: 6,
    cols: 6,
    objects: [{ row: 2, col: 0 }],
    targets: [{ row: 2, col: 3 }],
    obstacles: [],
    anchors: [{ row: 2, col: 4 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors'], notes: 'The sideways version of "Held in Place": a slide stops one cell short of the wall against the anchored object.' },
  },
  {
    id: 'level-032',
    order: 32,
    name: 'Bump the Ceiling',
    rows: 6,
    cols: 6,
    objects: [{ row: 5, col: 2 }],
    targets: [{ row: 2, col: 2 }],
    obstacles: [],
    anchors: [{ row: 1, col: 2 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors'], notes: 'Anchors stop upward gravity too - rise until the pinned object is in the way.' },
  },
  {
    id: 'level-033',
    order: 33,
    name: 'Different Depths',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 4 }],
    targets: [{ row: 3, col: 1 }, { row: 4, col: 4 }],
    obstacles: [],
    anchors: [{ row: 4, col: 1 }, { row: 5, col: 4 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors', 'multi-object'], notes: 'One pull, two objects: each stops at its own anchor, so they finish on different rows.' },
  },
  {
    id: 'level-034',
    order: 34,
    name: 'Not My Lane',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 2 }],
    targets: [{ row: 5, col: 2 }],
    obstacles: [],
    anchors: [{ row: 2, col: 1 }, { row: 2, col: 3 }],
    difficulty: 'easy',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors'], notes: 'Two anchors flank the drop but sit in other columns - an anchor only blocks its own row or column, so the drop is clean.' },
  },
  {
    id: 'level-035',
    order: 35,
    name: 'Around the Elbow',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 3, col: 3 }],
    obstacles: [],
    anchors: [{ row: 4, col: 0 }, { row: 3, col: 4 }],
    difficulty: 'easy',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'Two anchors cooperate: one stops the drop, the next stops the slide - an L-shaped path in two moves.' },
  },

  // ---- Tier 9 (36-40): read how an anchor changes a move --------------
  {
    id: 'level-036',
    order: 36,
    name: 'Halfway Down',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 3 }],
    targets: [{ row: 3, col: 6 }],
    obstacles: [],
    anchors: [{ row: 4, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'The anchor gives a precise mid-column stop; from there one slide reaches the wall on the target row.' },
  },
  {
    id: 'level-037',
    order: 37,
    name: 'Wall, Then Rest',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 3 }],
    targets: [{ row: 4, col: 0 }],
    obstacles: [],
    anchors: [{ row: 5, col: 0 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'Slide to the wall first; the anchor then catches the drop above the floor.' },
  },
  {
    id: 'level-038',
    order: 38,
    name: 'Corner Pocket',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 4 }],
    targets: [{ row: 7, col: 6 }],
    obstacles: [],
    anchors: [{ row: 7, col: 7 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors'], notes: 'An anchor against the far wall turns the second-to-last cell into a pocket you slide into.' },
  },
  {
    id: 'level-039',
    order: 39,
    name: 'Wrong Way Down',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 5, col: 0 }],
    obstacles: [],
    anchors: [{ row: 3, col: 0 }],
    difficulty: 'medium',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'Dropping straight down is pinned shut - the target is only reachable by leaving the column and coming back along the floor.' },
  },
  {
    id: 'level-040',
    order: 40,
    name: 'The Long Way Round',
    rows: 7,
    cols: 7,
    objects: [{ row: 6, col: 0 }],
    targets: [{ row: 6, col: 5 }],
    obstacles: [],
    anchors: [{ row: 6, col: 4 }],
    difficulty: 'medium',
    metadata: { minMoves: 4, stars: { two: 7, three: 4 }, tags: ['anchors', 'planning'], notes: 'A single anchor mid-row blocks the direct slide - the object has to go up, across the top, down the far wall and back in.' },
  },

  // ---- Tier 10 (41-45): multiple objects + anchors -------------------
  {
    id: 'level-041',
    order: 41,
    name: 'Stacked Landing',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 3 }, { row: 1, col: 3 }],
    targets: [{ row: 3, col: 3 }, { row: 4, col: 3 }],
    obstacles: [],
    anchors: [{ row: 5, col: 3 }],
    difficulty: 'medium',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors', 'multi-object'], notes: 'An anchor lets a two-object stack come to rest in the middle of the board instead of on the floor.' },
  },
  {
    id: 'level-042',
    order: 42,
    name: 'One Lane Blocked',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 4 }],
    targets: [{ row: 6, col: 1 }, { row: 2, col: 4 }],
    obstacles: [],
    anchors: [{ row: 3, col: 4 }],
    difficulty: 'medium',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors', 'multi-object'], notes: 'The same pull sends the two objects to very different places because only one column has an anchor in it.' },
  },
  {
    id: 'level-043',
    order: 43,
    name: 'Three at Once',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 4 }, { row: 0, col: 6 }],
    targets: [{ row: 7, col: 1 }, { row: 3, col: 4 }, { row: 5, col: 6 }],
    obstacles: [],
    anchors: [{ row: 4, col: 4 }, { row: 6, col: 6 }],
    difficulty: 'medium',
    metadata: { minMoves: 1, stars: { two: 3, three: 1 }, tags: ['anchors', 'multi-object'], notes: 'Three objects, three different anchor situations, all resolved by a single drop - the challenge is reading all three at once.' },
  },
  {
    id: 'level-044',
    order: 44,
    name: 'Wedged Still',
    rows: 7,
    cols: 7,
    objects: [{ row: 3, col: 6 }, { row: 0, col: 6 }],
    targets: [{ row: 3, col: 1 }, { row: 2, col: 0 }],
    obstacles: [],
    anchors: [{ row: 3, col: 0 }, { row: 4, col: 1 }],
    difficulty: 'medium',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'Slide one object into a pocket where it is trapped against the next gravity pull, so the move that places the other object leaves it alone.' },
  },
  {
    id: 'level-045',
    order: 45,
    name: 'Blocked From Behind',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 1 }, { row: 0, col: 3 }],
    targets: [{ row: 5, col: 0 }, { row: 6, col: 0 }],
    obstacles: [],
    anchors: [{ row: 6, col: 1 }],
    difficulty: 'medium',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'One object has to become a stop for the other; the anchor sets the vertical offset between their two targets.' },
  },

  // ---- Tier 11 (46-50): plan several moves ahead ---------------------
  {
    id: 'level-046',
    order: 46,
    name: 'Wedge and Pin',
    rows: 8,
    cols: 8,
    objects: [{ row: 5, col: 7 }, { row: 7, col: 5 }],
    targets: [{ row: 5, col: 0 }, { row: 2, col: 5 }],
    obstacles: [],
    anchors: [{ row: 4, col: 0 }, { row: 6, col: 0 }, { row: 1, col: 5 }, { row: 7, col: 4 }],
    difficulty: 'hard',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'Two objects placed by a single pull: one is wedged between two anchors so it holds still, the other is pinned in its column so it does not drift.' },
  },
  {
    id: 'level-047',
    order: 47,
    name: 'Two-Step Stair',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 7 }],
    obstacles: [],
    anchors: [{ row: 3, col: 0 }, { row: 0, col: 4 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'One anchor caps the first drop, the other caps the first slide - a two-step staircase to the far corner.' },
  },
  {
    id: 'level-048',
    order: 48,
    name: 'Back to the Middle',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 4 }],
    obstacles: [],
    anchors: [{ row: 3, col: 0 }, { row: 7, col: 3 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'The start-column anchor makes going down first the slow way; going around and letting the floor anchor catch you lands exactly on target.' },
  },
  {
    id: 'level-049',
    order: 49,
    name: 'Double Back',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 4 }],
    targets: [{ row: 0, col: 0 }],
    obstacles: [],
    anchors: [{ row: 0, col: 2 }, { row: 3, col: 0 }, { row: 3, col: 4 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'The target is on the start row but an anchor blocks the direct slide - drop, cross under, and rise back up into it.' },
  },
  {
    id: 'level-050',
    order: 50,
    name: 'Over the Top',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 7 }],
    obstacles: [{ row: 0, col: 4 }],
    anchors: [{ row: 7, col: 3 }],
    difficulty: 'hard',
    metadata: { minMoves: 4, stars: { two: 7, three: 4 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'An obstacle caps the top row and an anchor caps the floor; the object has to zig-zag between them in four moves.' },
  },

  // ---- Tier 12 (51-55): busier layouts, several anchors -------------
  {
    id: 'level-051',
    order: 51,
    name: 'Middle Child',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }, { row: 0, col: 3 }, { row: 2, col: 7 }],
    targets: [{ row: 7, col: 0 }, { row: 3, col: 3 }, { row: 7, col: 1 }],
    obstacles: [],
    anchors: [{ row: 4, col: 3 }, { row: 3, col: 2 }],
    difficulty: 'hard',
    metadata: { minMoves: 2, stars: { two: 4, three: 2 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'Three objects: the middle one is wedged so the second move (needed for the third object) does not disturb it; the third object stops against the first.' },
  },
  {
    id: 'level-052',
    order: 52,
    name: 'Every Route Pinned',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 4 }],
    targets: [{ row: 7, col: 0 }],
    obstacles: [],
    anchors: [{ row: 3, col: 4 }, { row: 0, col: 2 }, { row: 7, col: 2 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'Three anchors close off the direct drop and both floor approaches - the only path is drop, cross, drop.' },
  },
  {
    id: 'level-053',
    order: 53,
    name: 'Wall and Pin',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 2 }],
    obstacles: [{ row: 0, col: 4 }],
    anchors: [{ row: 7, col: 1 }],
    difficulty: 'hard',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'The obstacle sets which column you fall down; the floor anchor stops the last slide dead on the target.' },
  },
  {
    id: 'level-054',
    order: 54,
    name: 'The Staircase',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 6, col: 7 }],
    obstacles: [],
    anchors: [{ row: 4, col: 0 }, { row: 3, col: 4 }, { row: 7, col: 3 }],
    difficulty: 'hard',
    metadata: { minMoves: 4, stars: { two: 7, three: 4 }, tags: ['anchors', 'planning'], notes: 'A clean four-leg serpentine - one anchor caps each leg: down, across, down, across.' },
  },
  {
    id: 'level-055',
    order: 55,
    name: 'Threading Two',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    targets: [{ row: 7, col: 6 }, { row: 7, col: 7 }],
    obstacles: [],
    anchors: [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 4, col: 7 }],
    difficulty: 'hard',
    metadata: { minMoves: 5, stars: { two: 9, three: 5 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'Two objects share a zig-zag corridor formed by paired anchors; they stay a step apart the whole way down.' },
  },

  // ---- Tier 13 (56-60): advanced but fair --------------------------
  {
    id: 'level-056',
    order: 56,
    name: 'Early Drop',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 5, col: 7 }],
    obstacles: [],
    anchors: [{ row: 0, col: 4 }, { row: 3, col: 0 }, { row: 6, col: 7 }],
    difficulty: 'expert',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'planning'], notes: 'An anchor on the start row forces an early drop; a far anchor stops the final fall one row above the floor.' },
  },
  {
    id: 'level-057',
    order: 57,
    name: 'Neither Edge',
    rows: 8,
    cols: 8,
    objects: [{ row: 7, col: 0 }],
    targets: [{ row: 0, col: 7 }],
    obstacles: [{ row: 7, col: 3 }],
    anchors: [{ row: 3, col: 0 }, { row: 0, col: 3 }],
    difficulty: 'expert',
    metadata: { minMoves: 3, stars: { two: 6, three: 3 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'The bottom row is blocked by an obstacle and the top row by an anchor - the object threads the middle (rising twice) to reach the far top corner.' },
  },
  {
    id: 'level-058',
    order: 58,
    name: 'Hold and Route',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }, { row: 4, col: 7 }],
    targets: [{ row: 7, col: 3 }, { row: 7, col: 7 }],
    obstacles: [],
    anchors: [{ row: 3, col: 7 }, { row: 5, col: 7 }, { row: 7, col: 4 }],
    difficulty: 'expert',
    metadata: { minMoves: 4, stars: { two: 7, three: 4 }, tags: ['anchors', 'multi-object', 'planning'], notes: 'One object is wedged in the right-hand column while the other is walked left, down, right and down into its target.' },
  },
  {
    id: 'level-059',
    order: 59,
    name: 'The Weave',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 7 }],
    targets: [{ row: 7, col: 3 }],
    obstacles: [{ row: 0, col: 4 }],
    anchors: [{ row: 4, col: 7 }, { row: 7, col: 4 }, { row: 3, col: 3 }],
    difficulty: 'expert',
    metadata: { minMoves: 6, stars: { two: 10, three: 6 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'A six-move weave: down, across, up, across, down, and one last slide onto the target between two blockers.' },
  },
  {
    id: 'level-060',
    order: 60,
    name: 'Everything Learned',
    rows: 8,
    cols: 8,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 7, col: 7 }],
    obstacles: [{ row: 0, col: 4 }, { row: 7, col: 4 }],
    anchors: [{ row: 3, col: 3 }, { row: 3, col: 7 }, { row: 4, col: 0 }],
    difficulty: 'expert',
    metadata: { minMoves: 7, stars: { two: 11, three: 7 }, tags: ['anchors', 'obstacles', 'planning'], notes: 'The grand finale: obstacles cap both middle edges, three anchors break every straight line, and the only route is a seven-move climb down, across, down, back, up, across and down. The longest required solution in the game.' },
  },
];

/**
 * The star thresholds a level scores against. Almost always taken straight
 * from `level.metadata.stars`; the fallback only exists so a level authored
 * without explicit thresholds still scores predictably (optimal = 3 stars,
 * up to ~double = 2) instead of crashing or handing out free 3-star ratings.
 */
export function getStarThresholds(level: LevelDefinition): StarThresholds {
  if (level.metadata?.stars) return level.metadata.stars;

  const optimal = level.metadata?.minMoves ?? 1;
  return { three: optimal, two: Math.max(optimal + 2, optimal * 2) };
}

/** Looks up a level by its stable id. Returns `undefined` if not found. */
export function getLevelById(id: string): LevelDefinition | undefined {
  return LEVELS.find(level => level.id === id);
}

/** Looks up a level by its 1-based play order. Returns `undefined` if not found. */
export function getLevelByOrder(order: number): LevelDefinition | undefined {
  return LEVELS.find(level => level.order === order);
}
