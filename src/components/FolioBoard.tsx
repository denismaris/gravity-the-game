import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { describeFold, FolioFold, FolioPuzzle, sheetOf } from '../game/folio';
import { FolioBoardView, folioGeometry, inkColor } from './FolioBoardView';
import { mix } from './GameEmblem';
import { Text } from './Text';
import { theme, themedStyles } from '../theme';

export interface FolioBoardProps {
  puzzle: FolioPuzzle;
  folds: ReadonlyArray<FolioFold>;
  /** The room the board may take. */
  width: number;
  height: number;
  solved: boolean;
  onFold: (fold: FolioFold) => void;
  highlight?: FolioFold | null;
}

/** How wide a crease is to a finger, however thin it is drawn. */
const HIT = 30;

/**
 * The Skia-drawn sheet with a touch strip over every crease - the same
 * drawing/touch split every board here uses. A strip runs past both ends
 * of its crease, over the pips, so a fold can be started off the paper.
 */
export function FolioBoard({ puzzle, folds, width, height, solved, onFold, highlight }: FolioBoardProps): React.JSX.Element {
  const geometry = useMemo(() => folioGeometry(puzzle, width, height), [puzzle, width, height]);
  const sheet = useMemo(() => sheetOf(puzzle, { folds }), [puzzle, folds]);
  const origin = geometry.originOf(sheet);
  const { cell } = geometry;
  // The crease under the finger: its side is shown before it folds.
  const [preview, setPreview] = useState<FolioFold | null>(null);

  const creases: FolioFold[] = [];
  for (let at = 1; at < sheet.width; at += 1) creases.push({ axis: 'v', at });
  for (let at = 1; at < sheet.height; at += 1) creases.push({ axis: 'h', at });

  return (
    <View style={{ width: geometry.bedWidth, height: geometry.bedHeight + 2 }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <FolioBoardView puzzle={puzzle} folds={folds} geometry={geometry} solved={solved} highlight={highlight} preview={preview} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents={solved ? 'none' : 'box-none'}>
        {creases.map(fold => {
          const { crease, side } = describeFold(sheet, fold);
          const frame =
            fold.axis === 'v'
              ? { left: origin.x + fold.at * cell - HIT / 2, top: origin.y - 14, width: HIT, height: sheet.height * cell + 28 }
              : { left: origin.x - 14, top: origin.y + fold.at * cell - HIT / 2, width: sheet.width * cell + 28, height: HIT };
          return (
            <Pressable
              key={`${fold.axis}${fold.at}-${sheet.width}x${sheet.height}`}
              accessibilityRole="button"
              accessibilityLabel={`Fold along ${crease}`}
              accessibilityHint={`${side.charAt(0).toUpperCase()}${side.slice(1)} turns over`}
              onPressIn={() => setPreview(fold)}
              onPressOut={() => setPreview(null)}
              onPress={() => onFold(fold)}
              style={[styles.crease, frame]}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * The target, as the player is to make it: the same squares, small, on a
 * card of their own above the board.
 */
export const FolioTargetCard = React.memo(function FolioTargetCardImpl({ puzzle }: { puzzle: FolioPuzzle }): React.JSX.Element {
  const { target } = puzzle;
  const unit = Math.min(22, Math.floor(70 / Math.max(target.width, target.height)));
  const gap = 3;
  const lip = 2;
  const w = target.width * unit + (target.width - 1) * gap;
  const h = target.height * unit + (target.height - 1) * gap + lip;
  return (
    <View style={styles.targetCard} accessible accessibilityLabel={`Target: a ${target.width} by ${target.height} sheet, in ${puzzle.par} folds`}>
      <Canvas style={{ width: w, height: h }}>
        {target.inks.map((ink, i) => {
          const x = (i % target.width) * (unit + gap);
          const y = Math.floor(i / target.width) * (unit + gap);
          return (
            <React.Fragment key={i}>
              <RoundedRect x={x} y={y + lip} width={unit} height={unit} r={unit * 0.14} color={mix(inkColor(ink), theme.colors.shadow, ink === 'paper' ? 0.24 : 0.34)} />
              <RoundedRect x={x} y={y} width={unit} height={unit} r={unit * 0.14} color={inkColor(ink)} />
            </React.Fragment>
          );
        })}
      </Canvas>
      <View style={styles.targetText}>
        <Text style={styles.targetTitle}>Fold to match</Text>
        <Text style={styles.targetFolds}>{puzzle.par === 1 ? 'In 1 fold' : `In ${puzzle.par} folds`}</Text>
      </View>
    </View>
  );
});

const styles = themedStyles(() => ({
  crease: { position: 'absolute' },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.sm + 2,
    paddingRight: theme.spacing.lg,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.borderStrong,
  },
  targetText: { gap: 1 },
  targetTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    lineHeight: theme.typography.lineHeights.subtitle,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  targetFolds: {
    fontSize: theme.typography.sizes.caption,
    lineHeight: theme.typography.lineHeights.caption,
    color: theme.colors.textSecondary,
  },
}));
