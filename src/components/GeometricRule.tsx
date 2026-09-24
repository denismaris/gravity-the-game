import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { theme } from '../theme';

/**
 * How loud the mark is. The design reference is restrained - a lot of
 * quiet ground and a few deliberate marks - so only one place in the app
 * gets the full arrangement, and everywhere else gets something quieter
 * that reads as the same family without competing for attention.
 */
export type GeometricRuleVariant = 'masthead' | 'stage' | 'quiet';

export interface GeometricRuleProps {
  readonly variant?: GeometricRuleVariant;
  /** Overrides the rule and mark colour - for a surface whose ink isn't
   * the app's own (a dark board panel, say). */
  readonly color?: string;
  readonly accentColor?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const HEIGHTS: Record<GeometricRuleVariant, number> = {
  masthead: 18,
  stage: 14,
  quiet: 12,
};

/**
 * The app's signature mark: a rule carrying the poster palette's own
 * geometric vocabulary - grouped vertical bars, a filled disc, a half-disc
 * resting flat on the line.
 *
 * Borrowing the reference's *colours* alone left the app merely warm;
 * borrowing one arrangement of its shapes is what makes it read as
 * belonging to that poster. Using the same arrangement everywhere would
 * turn a signature into wallpaper, hence `variant`: the masthead carries
 * the full phrase, a board's own rules carry a fragment of it.
 *
 * Measures itself, so a caller only has to drop it in - every screen that
 * wants one already has a full-width slot for it and would otherwise need
 * its own `onLayout` plumbing.
 */
export function GeometricRule({
  variant = 'stage',
  color,
  accentColor,
  style,
}: GeometricRuleProps): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const height = HEIGHTS[variant];
  const midY = height / 2;
  const ink = color ?? theme.colors.primary;
  const accent = accentColor ?? theme.colors.secondary;

  return (
    <View
      style={[styles.rule, { height }, style]}
      pointerEvents="none"
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={midY - 0.5} width={width} height={1} color={theme.colors.borderStrong} />
          {variant === 'masthead' && <MastheadMarks width={width} midY={midY} ink={ink} accent={accent} />}
          {variant === 'stage' && <StageMarks width={width} midY={midY} ink={ink} accent={accent} />}
          {variant === 'quiet' && <QuietMarks width={width} midY={midY} ink={ink} />}
        </Canvas>
      )}
    </View>
  );
}

interface MarkProps {
  readonly width: number;
  readonly midY: number;
  readonly ink: string;
  readonly accent?: string;
}

/** Bars at one third, the accent disc at centre, a half-disc past it -
 * marks placed at fractions of the real width so the rhythm holds on any
 * screen rather than bunching up on a narrow one. */
function MastheadMarks({ width, midY, ink, accent }: MarkProps): React.JSX.Element {
  return (
    <Group>
      {bars(width * 0.16, midY, ink, 4, 11)}
      <Circle cx={width * 0.5} cy={midY} r={4} color={accent} />
      <Path path={halfDisc(width * 0.82, midY, 8)} color={ink} />
    </Group>
  );
}

/** A fragment of the masthead phrase: the bars and one small disc, no
 * half-disc. Sits above a board, so it stays a quiet frame. */
function StageMarks({ width, midY, ink, accent }: MarkProps): React.JSX.Element {
  return (
    <Group>
      {bars(width * 0.07, midY, ink, 3, 8)}
      <Circle cx={width * 0.5} cy={midY} r={3} color={accent} />
      {bars(width * 0.93 - 14, midY, ink, 3, 8)}
    </Group>
  );
}

/** The quietest member - bars alone, centred. */
function QuietMarks({ width, midY, ink }: MarkProps): React.JSX.Element {
  return <Group>{bars(width * 0.5 - 10, midY, ink, 3, 7)}</Group>;
}

const styles = StyleSheet.create({
  rule: { alignSelf: 'stretch' },
});

function bars(x: number, midY: number, color: string, count: number, height: number): React.JSX.Element[] {
  const barWidth = 2;
  const gap = 5;
  return Array.from({ length: count }, (_unused, i) => (
    <Rect
      key={`bar-${i}`}
      x={x + i * (barWidth + gap)}
      y={midY - height / 2}
      width={barWidth}
      height={height}
      color={color}
    />
  ));
}

/** A half-disc sitting flat on the rule. */
function halfDisc(cx: number, midY: number, r: number): string {
  return `M ${cx - r} ${midY} A ${r} ${r} 0 0 1 ${cx + r} ${midY} Z`;
}
