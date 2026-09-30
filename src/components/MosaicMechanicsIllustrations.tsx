import React from 'react';
import { Group, Path } from '@shopify/react-native-skia';
import { getMosaicById, MosaicState, orient } from '../game/mosaic';
import { theme } from '../theme';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { mosaicGeometry, MosaicBoardView, pieceColor, Tesserae } from './MosaicBoardView';

/**
 * Mosaic's tutorial pictures are drawn by the real board, on the first easy
 * puzzle - so the tutorial shows exactly what the game will look like.
 */
const HEART = getMosaicById('mosaic-easy-01')!;

function placed(count: number): MosaicState {
  return {
    pieces: HEART.pieces.map((_p, i) =>
      i < count
        ? { rotation: HEART.solution[i].rotation, flipped: false, at: { row: HEART.solution[i].row, col: HEART.solution[i].col } }
        : { rotation: 0, flipped: false, at: null },
    ),
  };
}

function Board({ state, solved = false, ghostIndex }: { state: MosaicState; solved?: boolean; ghostIndex?: number }) {
  const geometry = mosaicGeometry(HEART, ILLUSTRATION_WIDTH * 0.6, ILLUSTRATION_HEIGHT - 12);
  const ghost =
    ghostIndex === undefined
      ? null
      : {
          cells: orient(HEART.pieces[ghostIndex].cells, HEART.solution[ghostIndex]).map(c => ({
            row: c.row + HEART.solution[ghostIndex].row,
            col: c.col + HEART.solution[ghostIndex].col,
          })),
          color: pieceColor(HEART, ghostIndex),
        };
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - geometry.width) / 2 }, { translateY: (ILLUSTRATION_HEIGHT - geometry.height) / 2 }]}>
      <MosaicBoardView puzzle={HEART} state={state} geometry={geometry} ghost={ghost} solved={solved} />
    </Group>
  );
}

function TurnIllustration(): React.JSX.Element {
  const piece = HEART.pieces[0];
  const cell = 18;
  const color = pieceColor(HEART, 0);
  const cy = ILLUSTRATION_HEIGHT / 2;
  return (
    <Group>
      <Group transform={[{ translateX: ILLUSTRATION_WIDTH / 2 - 92 }, { translateY: cy - cell * 1.6 }]}>
        <Tesserae cells={orient(piece.cells, { rotation: 0, flipped: false })} color={color} cellSize={cell} seed={0} />
      </Group>
      {/* A quarter-turn arrow between the two facings. */}
      <Path
        path={`M ${ILLUSTRATION_WIDTH / 2 - 16} ${cy - 10} Q ${ILLUSTRATION_WIDTH / 2} ${cy - 30} ${ILLUSTRATION_WIDTH / 2 + 16} ${cy - 10}`}
        color={theme.colors.textSecondary}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />
      <Path
        path={`M ${ILLUSTRATION_WIDTH / 2 + 16} ${cy - 10} l -8 -2 m 8 2 l -2 -8`}
        color={theme.colors.textSecondary}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />
      <Group transform={[{ translateX: ILLUSTRATION_WIDTH / 2 + 40 }, { translateY: cy - cell * 1.6 }]}>
        <Tesserae cells={orient(piece.cells, { rotation: 1, flipped: false })} color={color} cellSize={cell} seed={0} />
      </Group>
    </Group>
  );
}

export function renderMosaicIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'drag':
      return <Board state={placed(3)} ghostIndex={3} />;
    case 'turn':
      return <TurnIllustration />;
    case 'fill':
      return <Board state={placed(HEART.pieces.length)} solved />;
    default:
      return <Group />;
  }
}
