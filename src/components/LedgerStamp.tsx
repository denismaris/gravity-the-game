import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, DashPathEffect, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { GameKind } from '../game/journey';
import { Stamp } from '../progression';
import { theme, themedStyles } from '../theme';
import { GameEmblemGlyph } from './GameEmblem';
import { PressableScale } from './PressableScale';

/** Each rank's metal: [frame, band]. */
const METALS: ReadonlyArray<readonly [string, string]> = [
  ['#A8703A', '#EBD2B4'], // bronze
  ['#7F8994', '#DFE3E8'], // silver
  ['#B08A1C', '#F1DC9A'], // gold
  ['#4F8190', '#CFE4EA'], // platinum
];

/**
 * A postage stamp's outline: a rectangle whose edges are bitten by
 * perforation holes. Each edge is walked clockwise, and every hole is an
 * arc bending *into* the stamp - the same sweep on all four sides.
 */
export function perforatedPath(w: number, h: number, r: number): string {
  const edge = (from: [number, number], to: [number, number]): string => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.max(2, Math.round(length / (r * 3.2)));
    const dx = (to[0] - from[0]) / n;
    const dy = (to[1] - from[1]) / n;
    const ux = dx / Math.hypot(dx, dy);
    const uy = dy / Math.hypot(dx, dy);
    let d = '';
    for (let i = 0; i < n; i += 1) {
      const cx = from[0] + dx * (i + 0.5);
      const cy = from[1] + dy * (i + 0.5);
      d += ` L ${cx - ux * r} ${cy - uy * r} A ${r} ${r} 0 0 0 ${cx + ux * r} ${cy + uy * r}`;
    }
    return `${d} L ${to[0]} ${to[1]}`;
  };
  return `M 0 0${edge([0, 0], [w, 0])}${edge([w, 0], [w, h])}${edge([w, h], [0, h])}${edge([0, h], [0, 0])} Z`;
}

export interface LedgerStampRowProps {
  kind: GameKind;
  stamps: ReadonlyArray<Stamp>;
  /** Width of one stamp; the row lays them out with even gaps. */
  stampWidth: number;
  /** Full width of the row. */
  width: number;
  onClaim: (stamp: Stamp) => void;
}

/**
 * One game's page in the album: its four stamps in a row. An earned stamp
 * is printed - paper, a frame in its metal, the game's emblem, its number
 * on a band; one still to be claimed glows gold and says what it pays.
 * An unearned one is only a dashed perforated outline with the emblem
 * ghosted inside: a space in the album waiting to be filled.
 *
 * Drawn as ONE canvas for the row, not a canvas per stamp - many small
 * canvases mounting together have failed to paint on a real device.
 */
export function LedgerStampRow({ kind, stamps, stampWidth, width, onClaim }: LedgerStampRowProps): React.JSX.Element {
  const height = Math.round(stampWidth * 1.22);
  const r = stampWidth * 0.045;
  const gap = stamps.length > 1 ? (width - stampWidth * stamps.length) / (stamps.length - 1) : 0;
  const outline = useMemo(() => Skia.Path.MakeFromSVGString(perforatedPath(stampWidth, height, r))!, [stampWidth, height, r]);
  const inset = stampWidth * 0.12;
  const band = height * 0.2;
  const emblem = stampWidth * 0.44;

  return (
    <View style={{ width, height }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {stamps.map((stamp, i) => {
          const [frame, bandColor] = METALS[Math.min(stamp.rank, METALS.length - 1)];
          const ready = stamp.earned && !stamp.claimed;
          return (
            <Group key={stamp.step} transform={[{ translateX: i * (stampWidth + gap) }]}>
              {stamp.earned ? (
                <Group>
                  <Path path={outline} color={ready ? '#FFF4D6' : theme.colors.surfaceHi} />
                  <Path path={outline} color={ready ? '#D9AE55' : theme.colors.borderStrong} style="stroke" strokeWidth={ready ? 1.8 : 1} />
                  <RoundedRect x={inset} y={inset} width={stampWidth - inset * 2} height={height - inset * 2} r={3} color={frame} style="stroke" strokeWidth={1.6} />
                  <RoundedRect x={inset + 0.8} y={height - inset - band} width={stampWidth - inset * 2 - 1.6} height={band - 0.8} r={2} color={bandColor} />
                </Group>
              ) : (
                <Path path={outline} color={theme.colors.borderStrong} style="stroke" strokeWidth={1}>
                  <DashPathEffect intervals={[3, 3]} />
                </Path>
              )}
              <GameEmblemGlyph kind={kind} size={emblem} x={(stampWidth - emblem) / 2} y={inset + (height - inset * 2 - band - emblem) / 2} opacity={stamp.earned ? 1 : 0.2} />
            </Group>
          );
        })}
      </Canvas>
      {stamps.map((stamp, i) => {
        const [frame] = METALS[Math.min(stamp.rank, METALS.length - 1)];
        const ready = stamp.earned && !stamp.claimed;
        const left = i * (stampWidth + gap);
        return (
          <PressableScale
            key={stamp.step}
            accessibilityRole={ready ? 'button' : 'image'}
            accessibilityLabel={`${stamp.step} solves stamp: ${stamp.claimed ? 'collected' : ready ? 'earned, tap to claim' : 'not yet earned'}`}
            onPress={ready ? () => onClaim(stamp) : undefined}
            disabled={!ready}
            scaleTo={0.94}
            containerStyle={[styles.hit, { left, width: stampWidth, height }]}
          >
            <View style={[styles.face, { paddingBottom: inset, height }]}>
              <Text style={[styles.step, { height: band, lineHeight: band }, stamp.earned ? { color: frame } : styles.stepAhead]}>{stamp.step}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  hit: { position: 'absolute', top: 0 },
  face: { justifyContent: 'flex-end', alignItems: 'center' },
  step: {
    fontFamily: theme.typography.families.mono,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stepAhead: { color: theme.colors.textTertiary },
}));
