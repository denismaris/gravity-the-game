import React from 'react';
import { DashPathEffect, Circle, Group, Path } from '@shopify/react-native-skia';
import {
  renderCircleMark,
  renderConstraintBadge,
  renderEmptyRing,
  renderSquareMark,
  renderTileChrome,
  hazardStripePaths,
} from './BinairoBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Binairo's own `MechanicsCarousel` illustrations, one function per
 * `TutorialSlide.illustration` key (see `BINAIRO_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`). Every shape is drawn with the real board's
 * own render functions (`renderCircleMark`, `renderConstraintBadge`, ...)
 * so a slide's circle/badge is pixel-identical to the one a player will
 * actually see, not a separately maintained illustration asset that can
 * drift from the real thing.
 */
export function renderBinairoIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'toggle':
      return <ToggleIllustration />;
    case 'triple':
      return <TripleIllustration />;
    case 'balance':
      return <BalanceIllustration />;
    case 'duplicate':
      return <DuplicateIllustration />;
    case 'equal':
      return <ConstraintIllustration constraintKind="same" />;
    case 'different':
      return <ConstraintIllustration constraintKind="different" />;
    case 'twin':
      return <TwinIllustration />;
    default:
      return <Group />;
  }
}

const STRIP_TILE = 50;
const STRIP_GAP = 10;

/** A tile drawn at `(tx, ty)` with a symbol/ring centred on it - the same
 * chrome+mark pairing every illustration below builds each tile from. */
function illustrationTile(key: string, tx: number, ty: number, size: number, content: React.ReactNode): React.JSX.Element {
  return (
    <Group key={key}>
      {renderTileChrome(tx, ty, size, false)}
      {content}
    </Group>
  );
}

function ToggleIllustration(): React.JSX.Element {
  const startX = (ILLUSTRATION_WIDTH - (STRIP_TILE * 4 + STRIP_GAP * 3)) / 2;
  const ty = (ILLUSTRATION_HEIGHT - STRIP_TILE) / 2;
  const R = STRIP_TILE * 0.32;
  // Blank -> square -> circle -> blank, the real tap cycle in `nextValue`.
  const states: Array<'blank' | 0 | 1> = ['blank', 0, 1, 'blank'];
  return (
    <Group>
      {states.map((state, i) => {
        const tx = startX + i * (STRIP_TILE + STRIP_GAP);
        const cx = tx + STRIP_TILE / 2;
        const cy = ty + STRIP_TILE / 2;
        const content =
          state === 'blank'
            ? renderEmptyRing(`sym-${i}`, cx, cy, R)
            : state === 0
              ? renderSquareMark(`sym-${i}`, cx, cy, R, theme.colors.binairoMarkOutline)
              : renderCircleMark(`sym-${i}`, cx, cy, R, theme.colors.binairoMarkFilled);
        return illustrationTile(`tile-${i}`, tx, ty, STRIP_TILE, content);
      })}
    </Group>
  );
}

function TripleIllustration(): React.JSX.Element {
  const startX = (ILLUSTRATION_WIDTH - (STRIP_TILE * 4 + STRIP_GAP * 3)) / 2;
  const ty = (ILLUSTRATION_HEIGHT - STRIP_TILE) / 2;
  const R = STRIP_TILE * 0.32;
  const fullWidth = STRIP_TILE * 4 + STRIP_GAP * 3;
  const clip = `M ${startX} ${ty} L ${startX + fullWidth} ${ty} L ${startX + fullWidth} ${ty + STRIP_TILE} L ${startX} ${ty + STRIP_TILE} Z`;
  return (
    <Group>
      {/* Hazard tape behind the tiles, spanning the whole illustrated line -
          the same "always the entire line" treatment the real board uses,
          not a tight box around just the three offending cells. */}
      <Group clip={clip}>
        {hazardStripePaths(startX, ty, fullWidth, STRIP_TILE, 4, 0).map((d, i) => (
          <Path key={i} path={d} color={theme.colors.danger} style="stroke" strokeWidth={4} opacity={0.55} />
        ))}
      </Group>
      <Path path={clip} color={theme.colors.danger} style="stroke" strokeWidth={1.5} opacity={0.8} />
      {[0, 1, 2, 3].map(i => {
        const tx = startX + i * (STRIP_TILE + STRIP_GAP);
        const cx = tx + STRIP_TILE / 2;
        const cy = ty + STRIP_TILE / 2;
        const content = i < 3 ? renderCircleMark(`sym-${i}`, cx, cy, R, theme.colors.binairoMarkFilled) : renderEmptyRing(`sym-${i}`, cx, cy, R);
        return illustrationTile(`tile-${i}`, tx, ty, STRIP_TILE, content);
      })}
    </Group>
  );
}

function BalanceIllustration(): React.JSX.Element {
  const startX = (ILLUSTRATION_WIDTH - (STRIP_TILE * 4 + STRIP_GAP * 3)) / 2;
  const ty = (ILLUSTRATION_HEIGHT - STRIP_TILE) / 2;
  const R = STRIP_TILE * 0.32;
  const values: Array<0 | 1> = [1, 0, 1, 0];
  return (
    <Group>
      {values.map((value, i) => {
        const tx = startX + i * (STRIP_TILE + STRIP_GAP);
        const cx = tx + STRIP_TILE / 2;
        const cy = ty + STRIP_TILE / 2;
        const content =
          value === 1
            ? renderCircleMark(`sym-${i}`, cx, cy, R, theme.colors.binairoMarkFilled)
            : renderSquareMark(`sym-${i}`, cx, cy, R, theme.colors.binairoMarkOutline);
        return illustrationTile(`tile-${i}`, tx, ty, STRIP_TILE, content);
      })}
    </Group>
  );
}

const DUP_TILE = 40;
const DUP_GAP = 8;
const DUP_ROW_GAP = 16;

function DuplicateRow(key: string, ty: number, flagged: boolean): React.JSX.Element {
  const startX = (ILLUSTRATION_WIDTH - (DUP_TILE * 4 + DUP_GAP * 3)) / 2;
  const R = DUP_TILE * 0.32;
  const values: Array<0 | 1> = [1, 0, 1, 0];
  const fullWidth = DUP_TILE * 4 + DUP_GAP * 3;
  return (
    <Group key={key}>
      {values.map((value, i) => {
        const tx = startX + i * (DUP_TILE + DUP_GAP);
        const cx = tx + DUP_TILE / 2;
        const cy = ty + DUP_TILE / 2;
        const content =
          value === 1
            ? renderCircleMark(`sym-${key}-${i}`, cx, cy, R, theme.colors.binairoMarkFilled)
            : renderSquareMark(`sym-${key}-${i}`, cx, cy, R, theme.colors.binairoMarkOutline);
        return illustrationTile(`tile-${key}-${i}`, tx, ty, DUP_TILE, content);
      })}
      {/* Flags the second row as a repeat of the first - a thin red outline
          around the whole row, not a new icon the player has to learn. */}
      {flagged && (
        <Path
          path={`M ${startX - 3} ${ty - 3} L ${startX + fullWidth + 3} ${ty - 3} L ${startX + fullWidth + 3} ${ty + DUP_TILE + 3} L ${startX - 3} ${ty + DUP_TILE + 3} Z`}
          color={theme.colors.danger}
          style="stroke"
          strokeWidth={2}
        />
      )}
    </Group>
  );
}

function DuplicateIllustration(): React.JSX.Element {
  const totalHeight = DUP_TILE * 2 + DUP_ROW_GAP;
  const topY = (ILLUSTRATION_HEIGHT - totalHeight) / 2;
  return (
    <Group>
      {DuplicateRow('a', topY, false)}
      {DuplicateRow('b', topY + DUP_TILE + DUP_ROW_GAP, true)}
    </Group>
  );
}

const PAIR_TILE = 60;
const PAIR_GAP = 30;

function ConstraintIllustration({ constraintKind }: { constraintKind: 'same' | 'different' }): React.JSX.Element {
  const startX = (ILLUSTRATION_WIDTH - (PAIR_TILE * 2 + PAIR_GAP)) / 2;
  const ty = (ILLUSTRATION_HEIGHT - PAIR_TILE) / 2;
  const R = PAIR_TILE * 0.32;
  const tx1 = startX;
  const tx2 = startX + PAIR_TILE + PAIR_GAP;
  const cx1 = tx1 + PAIR_TILE / 2;
  const cx2 = tx2 + PAIR_TILE / 2;
  const cy = ty + PAIR_TILE / 2;
  const badgeCx = (tx1 + tx2) / 2 + PAIR_TILE / 2;
  const badgeR = PAIR_TILE * 0.22;
  return (
    <Group>
      {illustrationTile('tile-1', tx1, ty, PAIR_TILE, renderCircleMark('sym-1', cx1, cy, R, theme.colors.binairoMarkFilled))}
      {illustrationTile(
        'tile-2',
        tx2,
        ty,
        PAIR_TILE,
        constraintKind === 'same'
          ? renderCircleMark('sym-2', cx2, cy, R, theme.colors.binairoMarkFilled)
          : renderSquareMark('sym-2', cx2, cy, R, theme.colors.binairoMarkOutline),
      )}
      {renderConstraintBadge('badge', badgeCx, cy, badgeR, constraintKind, false)}
    </Group>
  );
}

const TWIN_TILE = 24;
const TWIN_GAP = 4;
const TWIN_GRID = 4;
/** Deliberately small and quiet - see `theme/colors.ts`'s own comment on
 * `binairoAccent` for why this colour, and `BinairoBoardView.tsx`'s twin
 * badge for why the in-game version is this size relative to a real
 * tile. This illustration's tiles are much smaller than a real board's,
 * so the dot is drawn at a flat pixel size rather than the same tile-
 * relative factor, or it would be all but invisible here. */
const TWIN_DOT_RADIUS = 4;

function TwinIllustration(): React.JSX.Element {
  const fullSize = TWIN_TILE * TWIN_GRID + TWIN_GAP * (TWIN_GRID - 1);
  const startX = (ILLUSTRATION_WIDTH - fullSize) / 2;
  const startY = (ILLUSTRATION_HEIGHT - fullSize) / 2;
  const R = TWIN_TILE * 0.32;

  const originOf = (row: number, col: number): { x: number; y: number } => ({
    x: startX + col * (TWIN_TILE + TWIN_GAP),
    y: startY + row * (TWIN_TILE + TWIN_GAP),
  });

  const a = originOf(0, 0);
  const b = originOf(TWIN_GRID - 1, TWIN_GRID - 1);
  const aCentre = { x: a.x + TWIN_TILE / 2, y: a.y + TWIN_TILE / 2 };
  const bCentre = { x: b.x + TWIN_TILE / 2, y: b.y + TWIN_TILE / 2 };

  const tiles: React.JSX.Element[] = [];
  for (let row = 0; row < TWIN_GRID; row += 1) {
    for (let col = 0; col < TWIN_GRID; col += 1) {
      const isA = row === 0 && col === 0;
      const isB = row === TWIN_GRID - 1 && col === TWIN_GRID - 1;
      const origin = originOf(row, col);
      const cx = origin.x + TWIN_TILE / 2;
      const cy = origin.y + TWIN_TILE / 2;
      const content = isA || isB ? renderCircleMark(`sym-${row}-${col}`, cx, cy, R, theme.colors.binairoMarkFilled) : renderEmptyRing(`sym-${row}-${col}`, cx, cy, R);
      tiles.push(
        <Group key={`tile-${row}-${col}`}>
          {illustrationTile(`chrome-${row}-${col}`, origin.x, origin.y, TWIN_TILE, content)}
          {(isA || isB) && (
            <Circle
              cx={origin.x + TWIN_TILE - TWIN_DOT_RADIUS - 2}
              cy={origin.y + TWIN_DOT_RADIUS + 2}
              r={TWIN_DOT_RADIUS}
              color={theme.colors.binairoAccent}
            />
          )}
        </Group>,
      );
    }
  }

  return (
    <Group>
      {/* Teaching-only reference line across the two twinned cells - the
          real in-game badge never draws this (see `BinairoBoardView.tsx`'s
          twin badge comment); a diagram is allowed to explain the rule
          once with a line this component alone ever needs. */}
      <Path path={`M ${aCentre.x} ${aCentre.y} L ${bCentre.x} ${bCentre.y}`} color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.5} opacity={0.5}>
        <DashPathEffect intervals={[4, 4]} />
      </Path>
      {tiles}
    </Group>
  );
}
