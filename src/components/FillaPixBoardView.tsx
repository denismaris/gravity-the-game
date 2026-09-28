import React, { useMemo } from 'react';
import { Circle, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { FillaPixCell, FillaPixPuzzle, FillaPixState } from '../game/fillapix';
import { BoardLayout, computeBoardLayout, shade, useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

const TILE_GAP = 6;
export const TILE_RADIUS = 8;
const PULSE_MS = 420;

/** The board's own tray - same "paper slab with a light-catching seam and
 * an accent-tinted outline" this app already uses for every ruled-tile
 * board (`BinairoBoardView.renderTray`), swapped to Fill-a-Pix's own
 * accent so the one recurring idea ("a board is a slab, not a flat
 * rectangle") stays consistent rather than each game reinventing it. */
function renderTray(layout: BoardLayout): React.JSX.Element {
  const { boardSize } = layout;
  return (
    <Group>
      <RoundedRect x={0} y={0} width={boardSize} height={boardSize} r={10} color={theme.colors.surfaceHi}>
        <LinearGradient start={vec(0, 0)} end={vec(boardSize, boardSize)} colors={['#FFFFFF', theme.colors.surfaceHi, '#EFE9DC']} positions={[0, 0.55, 1]} />
      </RoundedRect>
      <Path path={`M 1.5 ${boardSize - 10} L 1.5 10 Q 1.5 1.5 10 1.5 L ${boardSize - 10} 1.5`} color="rgba(255,255,255,0.9)" style="stroke" strokeWidth={1.5} strokeCap="round" />
      <Path
        path={`M ${boardSize - 1.5} 10 L ${boardSize - 1.5} ${boardSize - 10} Q ${boardSize - 1.5} ${boardSize - 1.5} ${boardSize - 10} ${boardSize - 1.5} L 10 ${boardSize - 1.5}`}
        color="rgba(59,31,82,0.16)"
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
      />
      <RoundedRect x={1} y={1} width={boardSize - 2} height={boardSize - 2} r={9} color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
}

/** One tile's face - solid paper when empty, a flat satin wash of this
 * game's accent when filled, matching the spec's own "filled cells show
 * a solid color, empty cells are white" plainly rather than a translucent
 * overlay that would fight with the live clue-status colour drawn on top
 * of it (see `FillaPixBoard`'s clue numerals). */
function renderTile(tx: number, ty: number, tileSize: number, filled: boolean, pulse: number): React.JSX.Element {
  const r = tileSize * 0.28;
  if (!filled) {
    return (
      <>
        <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={r} color={theme.colors.surfaceHi} />
        <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={r} color={theme.colors.border} style="stroke" strokeWidth={1} />
      </>
    );
  }
  return (
    <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={r} color={theme.colors.fillapixAccent} opacity={pulse}>
      <LinearGradient start={vec(tx, ty)} end={vec(tx, ty + tileSize)} colors={[shade(theme.colors.fillapixAccent, 1.28), theme.colors.fillapixAccent, shade(theme.colors.fillapixAccent, 0.72)]} positions={[0, 0.45, 1]} />
    </RoundedRect>
  );
}

interface StaticFillaPixTilesProps {
  puzzle: FillaPixPuzzle;
  state: FillaPixState;
  layout: BoardLayout;
  /** Which cells carry a clue - drawn with a small plaque under where
   * `FillaPixBoard`'s own RN `<Text>` digit will sit, so that digit's
   * live green/red colour reads clearly whether the tile under it is
   * paper or this game's own (fairly dark) filled-accent wash. Passed as
   * a plain joined string, not a `Set`, for the same reason
   * `StaticBinairoTiles`' `transitioningKeys` is: `React.memo`'s default
   * shallow comparison needs a primitive to actually catch "unchanged". */
  clueKeys: string;
  /** Opacity multiplier applied to filled tiles only, for the brief
   * solve pulse - `1` the rest of the time. Kept out of this memoized
   * layer's own re-render trigger by living on the *unmemoized* parent
   * instead (see `FillaPixBoardView`) whenever it's actually animating. */
  pulse: number;
}

/** The board's static bulk - every tile's chrome plus every clue's
 * plaque, none of which depends on the animation clock. Memoized the
 * same way `StaticBinairoTiles`/`StaticMazeLayer` are: a fresh render on
 * every toggle is fine, a fresh render 60 times a second while the
 * player just looks at the board is not. */
const StaticFillaPixTiles = React.memo(function StaticFillaPixTilesImpl({ puzzle, state, layout, clueKeys, pulse }: StaticFillaPixTilesProps) {
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const clueSet = useMemo(() => new Set(clueKeys ? clueKeys.split(',') : []), [clueKeys]);
  const tiles: React.JSX.Element[] = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const tx = col * layout.cellSize + TILE_GAP;
      const ty = row * layout.cellSize + TILE_GAP;
      const filled = state.filled[row][col];
      const hasClue = clueSet.has(`${row}:${col}`);
      tiles.push(
        <Group key={`${row}-${col}`}>
          {renderTile(tx, ty, tileSize, filled, filled ? pulse : 1)}
          {hasClue && <Circle cx={tx + tileSize / 2} cy={ty + tileSize / 2} r={tileSize * 0.3} color="rgba(255,253,248,0.85)" />}
        </Group>,
      );
    }
  }
  return <>{tiles}</>;
});

export interface FillaPixBoardViewProps {
  puzzle: FillaPixPuzzle;
  state: FillaPixState;
  size: number;
  solved: boolean;
  /** Cell to ring briefly - a hint reveal. Timed by the screen, the same
   * `flashCell`/`setTimeout` convention `TowersScreen`'s own hint button
   * already uses. */
  flashCell?: FillaPixCell | null;
}

export function FillaPixBoardView({ puzzle, state, size, solved, flashCell }: FillaPixBoardViewProps): React.JSX.Element {
  const layout: BoardLayout = useMemo(() => computeBoardLayout(puzzle.size, size), [size, puzzle.size]);
  const clueKeys = useMemo(() => puzzle.clues.map(cell => `${cell.row}:${cell.col}`).join(','), [puzzle.clues]);

  // A single one-shot pulse across every filled tile the instant the
  // puzzle solves - the picture has been visible all along, so this is
  // the "that's it, you're done" beat rather than a big reveal. Reduced
  // motion keeps the clock off entirely rather than firing a gentler
  // version - "solved" is already conveyed by `PuzzleSolved`'s own card,
  // so this pulse is pure celebration with no state riding on it alone.
  const reducedMotion = useReducedMotion();
  const elapsed = useAnimationClock(solved && !reducedMotion, 60);
  const pulse = solved && !reducedMotion && elapsed < PULSE_MS ? 1 + 0.16 * Math.sin((elapsed / PULSE_MS) * Math.PI) : 1;

  return (
    <Group>
      {renderTray(layout)}
      <StaticFillaPixTiles puzzle={puzzle} state={state} layout={layout} clueKeys={clueKeys} pulse={pulse} />
      {flashCell && (
        <RoundedRect
          x={flashCell.col * layout.cellSize + TILE_GAP - 2}
          y={flashCell.row * layout.cellSize + TILE_GAP - 2}
          width={layout.cellSize - TILE_GAP * 2 + 4}
          height={layout.cellSize - TILE_GAP * 2 + 4}
          r={TILE_RADIUS + 2}
          color={theme.colors.fillapixAccent}
          style="stroke"
          strokeWidth={2.5}
        />
      )}
    </Group>
  );
}
