import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { BloomPuzzle, BloomState } from '../game/bloom';
import { BloomBoardView } from './BloomBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';

/**
 * Bloom's tutorial pictures are drawn by the real board, on tiny fixture
 * boards - so what the tutorial shows is exactly what the game draws,
 * with no second copy of the arc geometry to drift out of step.
 */

/** A circle round the middle of a 2x2: the smallest loop there is. */
const CIRCLE: BloomPuzzle = {
  id: 'bloom-illustration-circle',
  difficulty: 'easy',
  rows: 2,
  cols: 2,
  kinds: [
    ['arc', 'arc'],
    ['arc', 'arc'],
  ],
  solution: [
    [1, 2],
    [0, 3],
  ],
  start: [
    [1, 2],
    [0, 3],
  ],
  pinned: [
    [false, false],
    [false, false],
  ],
};

/** Two circles sharing a knot in the middle of a 3x3. */
const KNOT: BloomPuzzle = {
  id: 'bloom-illustration-knot',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  kinds: [
    ['empty', 'arc', 'arc'],
    ['arc', 'knot', 'arc'],
    ['arc', 'arc', 'empty'],
  ],
  solution: [
    [0, 1, 2],
    [1, 0, 3],
    [0, 3, 0],
  ],
  start: [
    [0, 1, 2],
    [1, 0, 3],
    [0, 3, 0],
  ],
  pinned: [
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ],
};

function Board({ puzzle, rotations, solved = false }: { puzzle: BloomPuzzle; rotations: BloomState['rotations']; solved?: boolean }) {
  const size = ILLUSTRATION_HEIGHT - 20;
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - size) / 2 }, { translateY: 10 }]}>
      <BloomBoardView puzzle={puzzle} state={{ rotations }} size={size} solved={solved} />
    </Group>
  );
}

export function renderBloomIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'turn':
      // One tile still facing away - its line runs into nothing.
      return (
        <Board
          puzzle={CIRCLE}
          rotations={[
            [3, 2],
            [0, 3],
          ]}
        />
      );
    case 'knot':
      return <Board puzzle={KNOT} rotations={KNOT.solution} />;
    case 'bloom':
      return <Board puzzle={CIRCLE} rotations={CIRCLE.solution} solved />;
    default:
      return <Group />;
  }
}
