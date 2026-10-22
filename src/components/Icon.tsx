import React from 'react';
import { StyleProp, TextStyle, View } from 'react-native';
import { Text } from './Text';
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { theme, themedStyles } from '../theme';

/**
 * The app's small icons, drawn - one family, one stroke weight, on one
 * 16-unit grid. They replace characters borrowed from fonts (‹ ⬆ ⇄ ✓ ✦),
 * which each came from a different typeface at a slightly different size
 * and weight, and read as placeholders rather than as a designed set.
 */
export type IconName = 'back' | 'share' | 'swap' | 'check' | 'spark' | 'sun' | 'settings' | 'restart' | 'undo';

const STROKES: Record<Exclude<IconName, 'spark'>, string> = {
  back: 'M 10 3 L 5 8 L 10 13',
  share: 'M 8 2.5 L 8 10 M 4.8 5.6 L 8 2.5 L 11.2 5.6 M 3.5 9 L 3.5 13.5 L 12.5 13.5 L 12.5 9',
  swap: 'M 3 5.5 L 12.5 5.5 M 10 3 L 12.5 5.5 L 10 8 M 13 10.5 L 3.5 10.5 M 6 8 L 3.5 10.5 L 6 13',
  check: 'M 3.5 8.5 L 6.6 11.6 L 12.5 4.6',
  restart: 'M 4.6 4.4 A 5 5 0 1 0 11.7 4.9 M 9.2 4.7 L 11.8 4.9 L 12 2.4',
  undo: 'M 6 3.5 L 3 6.5 L 6 9.5 M 3.5 6.5 L 9.8 6.5 A 3.4 3.4 0 0 1 9.8 13.3 L 6.8 13.3',
  sun: 'M 10.6 8 A 2.6 2.6 0 1 1 5.4 8 A 2.6 2.6 0 1 1 10.6 8 M 8 1.6 L 8 2.9 M 8 13.1 L 8 14.4 M 1.6 8 L 2.9 8 M 13.1 8 L 14.4 8 M 3.5 3.5 L 4.4 4.4 M 11.6 11.6 L 12.5 12.5 M 3.5 12.5 L 4.4 11.6 M 11.6 4.4 L 12.5 3.5',
  settings: 'M 2.5 5 L 4.3 5 M 7.9 5 L 13.5 5 M 2.5 11 L 8.1 11 M 11.7 11 L 13.5 11 M 7.9 5 A 1.8 1.8 0 1 1 4.3 5 A 1.8 1.8 0 1 1 7.9 5 M 11.7 11 A 1.8 1.8 0 1 1 8.1 11 A 1.8 1.8 0 1 1 11.7 11',
};

/** The Insight mark: a four-pointed star with soft, drawn-in sides. */
const SPARK = 'M 8 1.2 C 8.7 5.5 10.5 7.3 14.8 8 C 10.5 8.7 8.7 10.5 8 14.8 C 7.3 10.5 5.5 8.7 1.2 8 C 5.5 7.3 7.3 5.5 8 1.2 Z';

export function Icon({ name, size = 16, color = theme.colors.textPrimary, weight = 1.7 }: { name: IconName; size?: number; color?: string; weight?: number }): React.JSX.Element {
  const scale = size / 16;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        {name === 'spark' ? (
          <Path path={SPARK} color={color} />
        ) : (
          <Path path={STROKES[name]} color={color} style="stroke" strokeWidth={weight} strokeCap="round" strokeJoin="round" />
        )}
      </Group>
    </Canvas>
  );
}

/** "‹ Home" with a drawn chevron: the back link every screen's header has. */
export function BackLabel({ label, style }: { label: string; style?: StyleProp<TextStyle> }): React.JSX.Element {
  return (
    <View style={styles.back}>
      <Icon name="back" size={15} color={theme.colors.textPrimary} weight={2} />
      <Text style={style}>{label}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  back: { flexDirection: 'row', alignItems: 'center', gap: 3 },
}));
