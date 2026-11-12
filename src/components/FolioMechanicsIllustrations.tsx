import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { FolioFold, FolioPuzzle } from '../game/folio';
import { FolioBoardView, folioGeometry } from './FolioBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';

/**
 * Folio's tutorial pictures are drawn by the real board on small fixture
 * sheets, so the help shows exactly what the game draws.
 */
const SHEET: FolioPuzzle = {
  id: 'folio-illustration',
  difficulty: 'easy',
  width: 3,
  height: 2,
  squares: [
    { front: 'vermilion', back: 'paper' },
    { front: 'indigo', back: 'paper' },
    { front: 'vermilion', back: 'paper' },
    { front: 'indigo', back: 'paper' },
    { front: 'vermilion', back: 'paper' },
    { front: 'indigo', back: 'paper' },
  ],
  target: { width: 2, height: 1, inks: ['paper', 'vermilion'] },
  par: 2,
};

const STRIP: FolioPuzzle = {
  id: 'folio-illustration-strip',
  difficulty: 'medium',
  width: 3,
  height: 1,
  squares: [
    { front: 'vermilion', back: 'saffron' },
    { front: 'paper', back: 'indigo' },
    { front: 'indigo', back: 'vermilion' },
  ],
  target: { width: 2, height: 1, inks: ['saffron', 'indigo'] },
  par: 1,
};

function Board({ puzzle, folds = [], solved = false, highlight = null }: { puzzle: FolioPuzzle; folds?: ReadonlyArray<FolioFold>; solved?: boolean; highlight?: FolioFold | null }): React.JSX.Element {
  const geometry = folioGeometry(puzzle, ILLUSTRATION_WIDTH - 40, ILLUSTRATION_HEIGHT - 12);
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - geometry.bedWidth) / 2 }, { translateY: (ILLUSTRATION_HEIGHT - geometry.bedHeight) / 2 }]}>
      <FolioBoardView puzzle={puzzle} folds={folds} geometry={geometry} solved={solved} highlight={highlight} />
    </Group>
  );
}

export function renderFolioIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'fold':
      return <Board puzzle={SHEET} highlight={{ axis: 'v', at: 1 }} />;
    case 'corner':
      return <Board puzzle={STRIP} />;
    case 'target':
      return <Board puzzle={SHEET} folds={[{ axis: 'v', at: 1 }, { axis: 'h', at: 1 }]} solved />;
    default:
      return <Group />;
  }
}
