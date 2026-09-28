import React from 'react';
import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { adjacentTileColor } from './AdjacentBoardView';
import { theme } from '../theme';

/**
 * Adjacent's own `MechanicsCarousel` illustrations, one per
 * `TutorialSlide.illustration` key (see `ADJACENT_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`), drawn with the same tray, tiles and knocked
 * out glyphs the real board uses.
 *
 * The middle slide is the one that matters. "What is above falls in" is
 * the rule that decides whether a player is planning or just tapping,
 * and it is much easier to show than to say - so that slide draws the
 * same column twice, before and after, with the gap between them.
 */

const CELL = 26;
const GAP = 2;
const GRID = 4;
const GRID_W = GRID * CELL;

function tray(x: number, y: number, w: number, h: number): React.JSX.Element {
  return (
    <Group>
      <RoundedRect x={x} y={y} width={w} height={h} r={8} color={theme.colors.adjacentTray} />
      <RoundedRect x={x} y={y} width={w} height={h} r={8} color={theme.colors.adjacentAccent} style="stroke" strokeWidth={1.2} opacity={0.6} />
    </Group>
  );
}

/** One tile, or - for `colour === null` - the empty slot it left behind. */
function Tile({
  x,
  y,
  colour,
  ringed,
}: {
  x: number;
  y: number;
  colour: number | null;
  ringed?: boolean;
}): React.JSX.Element {
  const size = CELL - GAP * 2;
  const left = x + GAP;
  const top = y + GAP;
  const radius = size * 0.22;
  const cx = left + size / 2;
  const cy = top + size / 2;
  const r = size * 0.28;
  const ink = theme.colors.adjacentGlyph;

  if (colour === null) {
    return <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={theme.colors.adjacentSlot} />;
  }

  const glyph = ((): React.JSX.Element => {
    switch (colour % 5) {
      case 0:
        return <Circle cx={cx} cy={cy} r={r * 0.62} color={ink} />;
      case 1:
        return <Path path={`M ${cx} ${cy - r * 0.78} L ${cx + r * 0.78} ${cy} L ${cx} ${cy + r * 0.78} L ${cx - r * 0.78} ${cy} Z`} color={ink} />;
      case 2:
        return <Path path={`M ${cx} ${cy - r * 0.72} L ${cx + r * 0.72} ${cy + r * 0.56} L ${cx - r * 0.72} ${cy + r * 0.56} Z`} color={ink} />;
      case 3:
        return <RoundedRect x={cx - r * 0.8} y={cy - r * 0.26} width={r * 1.6} height={r * 0.52} r={r * 0.26} color={ink} />;
      default:
        return <Circle cx={cx} cy={cy} r={r * 0.62} color={ink} style="stroke" strokeWidth={Math.max(1.4, r * 0.26)} />;
    }
  })();

  return (
    <Group>
      <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={adjacentTileColor(colour)} />
      {glyph}
      {ringed && (
        <RoundedRect x={left - 2} y={top - 2} width={size + 4} height={size + 4} r={radius + 2} color={theme.colors.adjacentAccent} style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
}

/**
 * Lays out a small board from rows of digits, where `.` is an empty
 * slot - the same shorthand the engine's own tests read in, so an
 * illustration and a test fixture describe a board the same way.
 */
function board(rows: ReadonlyArray<string>, originX: number, originY: number, ringed?: ReadonlyArray<string>): React.JSX.Element {
  const ring = new Set(ringed ?? []);
  return (
    <Group>
      {tray(originX - 4, originY - 4, GRID_W + 8, rows.length * CELL + 8)}
      {rows.map((row, r) =>
        row.split('').map((ch, c) => (
          <Tile
            key={`${r}-${c}`}
            x={originX + c * CELL}
            y={originY + r * CELL}
            colour={ch === '.' ? null : Number(ch)}
            ringed={ring.has(`${r}:${c}`)}
          />
        )),
      )}
    </Group>
  );
}

const CENTRE_X = (ILLUSTRATION_WIDTH - GRID_W) / 2;

/** "Tap a tile" - a run of three ringed among tiles that are not part of
 * it, so the *connected* part reads as the point rather than the colour. */
function RunIllustration(): React.JSX.Element {
  // The ring has to enclose the *whole* connected run, or the slide
  // teaches the opposite of the rule: an earlier version left a fourth
  // gold tile touching the run and outside the ring, which says runs
  // stop somewhere arbitrary. Every gold tile here is inside the ring,
  // and the other colours are deliberately left with runs of their own
  // that are not ringed - there is more than one legal tap on any real
  // board.
  const rows = ['.1.3', '0113', '0203'];
  return (
    <Group>
      {board(rows, CENTRE_X, (ILLUSTRATION_HEIGHT - rows.length * CELL) / 2, ['0:1', '1:1', '1:2'])}
    </Group>
  );
}

/**
 * "The tray falls in" - the same two columns before and after, with an
 * arrow between. The cleared run is gone from the right-hand board and
 * the tile that was above it has dropped to the floor.
 */
function FallIllustration(): React.JSX.Element {
  const before = ['3.', '11', '02'];
  const after = ['..', '3.', '02'];
  const w = 2 * CELL;
  const y = (ILLUSTRATION_HEIGHT - before.length * CELL) / 2;
  const leftX = ILLUSTRATION_WIDTH / 2 - w - 26;
  const rightX = ILLUSTRATION_WIDTH / 2 + 26;

  return (
    <Group>
      {board(before, leftX, y, ['1:0', '1:1'])}
      {board(after, rightX, y)}
      {/* The arrow between the two states. */}
      <Path
        path={`M ${ILLUSTRATION_WIDTH / 2 - 14} ${y + CELL * 1.5} L ${ILLUSTRATION_WIDTH / 2 + 12} ${y + CELL * 1.5}`}
        color={theme.colors.adjacentAccent}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />
      <Path
        path={`M ${ILLUSTRATION_WIDTH / 2 + 6} ${y + CELL * 1.5 - 5} L ${ILLUSTRATION_WIDTH / 2 + 14} ${y + CELL * 1.5} L ${ILLUSTRATION_WIDTH / 2 + 6} ${y + CELL * 1.5 + 5} Z`}
        color={theme.colors.adjacentAccent}
      />
    </Group>
  );
}

/**
 * "Reach the target" - one big run, ringed, next to a filling progress
 * track. The run is drawn deliberately large because the slide's real
 * claim is that size is what pays.
 */
function TargetIllustration(): React.JSX.Element {
  const rows = ['.22.', '0222', '0221'];
  const y = (ILLUSTRATION_HEIGHT - rows.length * CELL) / 2 - 10;
  const ringed = ['0:1', '0:2', '1:1', '1:2', '1:3', '2:1', '2:2'];
  const trackY = y + rows.length * CELL + 14;
  const trackW = GRID_W;

  return (
    <Group>
      {board(rows, CENTRE_X, y, ringed)}
      {/* The target track, most of the way along. */}
      <RoundedRect x={CENTRE_X} y={trackY} width={trackW} height={5} r={2.5} color={theme.colors.surfaceAlt} />
      <RoundedRect x={CENTRE_X} y={trackY} width={trackW * 0.78} height={5} r={2.5} color={theme.colors.adjacentAccent} />
    </Group>
  );
}

export function renderAdjacentIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'run':
      return <RunIllustration />;
    case 'fall':
      return <FallIllustration />;
    case 'target':
      return <TargetIllustration />;
    default:
      return <Group />;
  }
}
