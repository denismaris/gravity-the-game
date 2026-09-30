import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { theme } from '../theme';
import { launchPieces } from './launchChoreography';

export interface TesseraMarkProps {
  /** Outer square size in pixels. */
  readonly size: number;
}

/**
 * The app's own mark, fully assembled and at rest - the same violet tile
 * and eighteen-piece star-and-cross the launch sequence builds piece by
 * piece (`launchChoreography.ts`), here drawn once with every piece already
 * at its landed position (`launchPieces`' own coordinates *are* the
 * assembled mark - nothing here re-derives the geometry).
 *
 * Home's masthead used to be text alone - a wordmark with no actual mark
 * next to it, on a screen the player opens every day, while the one truly
 * distinctive piece of visual identity this app has built lived inside a
 * two-second animation seen once per cold start and never again. This is
 * that same asset, given a permanent home: a colophon beside the wordmark,
 * the way a printed masthead pairs its title with the printer's own device.
 *
 * Deliberately static - Home already has its one loop (the play button's
 * halo), and a second thing moving here would read as restless rather than
 * alive, per `AlmanacBackdrop`'s own reasoning.
 */
export function TesseraMark({ size }: TesseraMarkProps): React.JSX.Element {
  const half = size / 2;
  const pieces = useMemo(() => launchPieces(), []);

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Tessera mark">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: half }, { translateY: half }]}>
          <RoundedRect x={-half} y={-half} width={size} height={size} r={size * 0.225} color={theme.colors.brandTile} />
          {pieces.map((piece, i) => (
            <Path
              key={i}
              path={`${piece.points
                .map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${(x * half).toFixed(2)} ${(y * half).toFixed(2)}`)
                .join(' ')} Z`}
              color={piece.color}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}
