import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { bridgeLinks, BridgesPuzzle, BridgesState, linkBetween } from '../game/bridges';
import { BridgesBoardView, BridgesDrag } from './BridgesBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';

/**
 * Bridges' tutorial pictures are drawn by the real board on tiny fixture
 * archipelagos - so the tutorial shows exactly what the game draws.
 */

// 1 . 1
// . . .
// . . .
const PAIR: BridgesPuzzle = {
  id: 'bridges-illustration-pair',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 1, col: 0, need: 2 },
    { row: 1, col: 2, need: 2 },
  ],
  solution: [2],
};

// 2 . 3
// . . .
// 1 . 2
const RING: BridgesPuzzle = {
  id: 'bridges-illustration-ring',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 0, col: 0, need: 2 },
    { row: 0, col: 2, need: 3 },
    { row: 2, col: 0, need: 1 },
    { row: 2, col: 2, need: 2 },
  ],
  solution: [2, 0, 1, 1],
};

// ? . 3   the top left island is in fog: the rest says it takes two
// . . .
// 1 . 2
const FOG_ISLANDS: BridgesPuzzle['islands'] = [
  { row: 0, col: 0, need: 2, fog: true },
  { row: 0, col: 2, need: 3 },
  { row: 2, col: 0, need: 1 },
  { row: 2, col: 2, need: 2 },
];
const FOG_BASE = { id: 'bridges-illustration-fog', difficulty: 'easy' as const, rows: 3, cols: 3, islands: FOG_ISLANDS };
const FOG_BUILT = (() => {
  const bridges = bridgeLinks(FOG_BASE).map(() => 0);
  const set = (i: number, j: number, n: number) => {
    const l = linkBetween({ ...FOG_BASE, solution: [] }, i, j);
    if (l !== null) bridges[l] = n;
  };
  set(0, 1, 1);
  set(0, 2, 1);
  set(1, 3, 2);
  return bridges;
})();
const FOG: BridgesPuzzle = { ...FOG_BASE, solution: FOG_BUILT };

function Board({ puzzle, state, drag = null }: { puzzle: BridgesPuzzle; state: BridgesState; drag?: BridgesDrag | null }) {
  const size = ILLUSTRATION_HEIGHT - 16;
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - size) / 2 }, { translateY: 8 }]}>
      <BridgesBoardView puzzle={puzzle} state={state} size={size} solved={false} drag={drag} />
    </Group>
  );
}

export function renderBridgesIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'drag':
      // Mid-drag: the ghost bridge reaching across toward the far island.
      return <Board puzzle={PAIR} state={{ bridges: [0] }} drag={{ source: 0, link: 0, progress: 0.7, snapped: true, blocked: false }} />;
    case 'double':
      return <Board puzzle={PAIR} state={{ bridges: [2] }} />;
    case 'network':
      return <Board puzzle={RING} state={{ bridges: RING.solution }} />;
    case 'fog':
      return <Board puzzle={FOG} state={{ bridges: FOG.solution }} />;
    default:
      return <Group />;
  }
}
