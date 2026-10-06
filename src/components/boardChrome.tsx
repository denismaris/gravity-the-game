import React from 'react';
import { Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { theme, inkWash } from '../theme';

/**
 * The paper tray every premium board here sits in: a near-neutral sheen,
 * a white highlight on the lit (top-left) edges, a dark rule on the shaded
 * ones, then the game's own accent rim. Lifted from `FillaPixBoardView`'s
 * `renderTray` so boards adopting it get the same numbers rather than a
 * hand-copied variant that drifts.
 */
export function PaperTray({ width, height, accent }: { width: number; height: number; accent: string }): React.JSX.Element {
  const r = 10;
  return (
    <Group>
      <RoundedRect x={0} y={0} width={width} height={height} r={r} color={theme.colors.surfaceHi}>
        <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]} positions={[0, 0.55, 1]} />
      </RoundedRect>
      <Path
        path={`M ${width - 1.5} ${r} L ${width - 1.5} ${height - r} Q ${width - 1.5} ${height - 1.5} ${width - r} ${height - 1.5} L ${r} ${height - 1.5}`}
        color={inkWash(0.16)}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
      />
      <RoundedRect x={1} y={1} width={width - 2} height={height - 2} r={r - 1} color={accent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
}

/** One framed well: an inset rounded square in `surfaceHi` with a hairline
 * `border` stroke, so an empty cell reads as a place rather than a hole. */
export function CellWell({ x, y, size, r }: { x: number; y: number; size: number; r: number }): React.JSX.Element {
  return (
    <>
      <RoundedRect x={x} y={y} width={size} height={size} r={r} color={theme.colors.surfaceHi} />
      <RoundedRect x={x} y={y} width={size} height={size} r={r} color={theme.colors.border} style="stroke" strokeWidth={1} />
    </>
  );
}
