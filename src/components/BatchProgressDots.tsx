import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { accentColorForKind } from '../game/journey';
import { BatchState } from '../progression';
import { motion, theme } from '../theme';

export interface BatchProgressDotsProps {
  readonly batch: BatchState;
  readonly style?: StyleProp<ViewStyle>;
}

const DOT_SIZE = 8;
const CURRENT_DOT_SIZE = 10;

/**
 * One small dot per puzzle in the current level's batch, each tinted with
 * that puzzle's own game's identity colour (`accentColorForKind`) - a
 * level being "a combination of games" was otherwise only ever stated in
 * a header line ("LEVEL 3 · MIRROR MAZE"); this makes the composition
 * itself visible at a glance, games still to come included - an
 * unfinished dot is still coloured (a hollow ring in that game's own
 * accent), a preview of what's coming rather than a mystery. A completed
 * dot fills in with a small pop (`motion.spring.pop`) - the same "small
 * glyph earning a reward-tier bounce" this app reserves for genuinely
 * rare, once-per-puzzle moments (a star, a "SOLVED" badge) - finishing
 * one puzzle in a batch of three-to-five is exactly that, not a repeat-
 * dozens-of-times tick like the header's own "N LEFT" kicker.
 */
export function BatchProgressDots({ batch, style }: BatchProgressDotsProps): React.JSX.Element {
  const completed = new Set(batch.completedPuzzleIds);
  const currentIndex = batch.puzzles.findIndex(p => !completed.has(p.puzzleId));

  // One `Animated.Value` per puzzle id, created lazily and kept for the
  // life of this batch - `batch.puzzles` itself is fixed once generated
  // (see `batches.ts`), so a puzzle id here is stable for as long as this
  // component is showing the same level.
  const fillsRef = useRef<Map<string, Animated.Value>>(new Map());
  const previousCompletedRef = useRef<ReadonlySet<string>>(new Set());

  for (const puzzle of batch.puzzles) {
    if (!fillsRef.current.has(puzzle.puzzleId)) {
      fillsRef.current.set(puzzle.puzzleId, new Animated.Value(completed.has(puzzle.puzzleId) ? 1 : 0));
    }
  }

  useEffect(() => {
    for (const puzzle of batch.puzzles) {
      const justCompleted = completed.has(puzzle.puzzleId) && !previousCompletedRef.current.has(puzzle.puzzleId);
      if (justCompleted) {
        Animated.spring(fillsRef.current.get(puzzle.puzzleId)!, {
          toValue: 1,
          useNativeDriver: true,
          ...motion.spring.pop,
        }).start();
      }
    }
    previousCompletedRef.current = completed;
    // `completed` is a fresh Set every render - keying off its own
    // contents (via `batch.completedPuzzleIds`) rather than the Set
    // reference itself is what actually gates this effect correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.completedPuzzleIds.join(',')]);

  return (
    <View style={[styles.row, style]}>
      {batch.puzzles.map((puzzle, index) => {
        const color = accentColorForKind(puzzle.kind);
        const fill = fillsRef.current.get(puzzle.puzzleId)!;
        const isCurrent = index === currentIndex;
        return (
          <View key={puzzle.puzzleId} style={[styles.dot, { borderColor: color }, isCurrent && styles.dotCurrent]}>
            <Animated.View
              style={[
                styles.dotFill,
                {
                  backgroundColor: color,
                  opacity: fill.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [{ scale: fill }],
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The current puzzle's own dot sits a touch larger than the rest - "you
  // are here" through scale alone, no separate glow/ring layer needed.
  dotCurrent: {
    width: CURRENT_DOT_SIZE,
    height: CURRENT_DOT_SIZE,
    borderRadius: CURRENT_DOT_SIZE / 2,
  },
  dotFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    // A large fixed radius, not tied to either dot size - the standard RN
    // trick for "always a perfect circle regardless of this view's actual
    // box size" (this same layer sits inside both `dot` and the larger
    // `dotCurrent`), since percentage `borderRadius` isn't reliable across
    // both platforms.
    borderRadius: 999,
  },
});
