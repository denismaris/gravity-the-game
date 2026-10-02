import React from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import type { Achievement, AchievementGroup } from '../progression';
import { theme } from '../theme';
import { GameEmblem } from './GameEmblem';

/** Each group's metal, once earned. */
function groupTone(group: AchievementGroup): string {
  switch (group) {
    case 'road':
      return theme.colors.secondary;
    case 'daily':
      return theme.colors.accent;
    case 'stars':
      return theme.colors.gold;
    case 'craft':
      return theme.colors.towersAccent;
    default:
      return theme.colors.primary;
  }
}

function star(c: number, r: number, inner: number): string {
  let d = '';
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : inner;
    d += `${i === 0 ? 'M' : 'L'} ${(c + Math.cos(a) * rr).toFixed(2)} ${(c + Math.sin(a) * rr).toFixed(2)} `;
  }
  return `${d}Z`;
}

/** The glyph a group stamps on its medals. */
function Glyph({ group, s, ink }: { group: AchievementGroup; s: number; ink: string }): React.JSX.Element {
  const c = s / 2;
  switch (group) {
    case 'daily': {
      let rays = '';
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        rays += `M ${c + Math.cos(a) * s * 0.2} ${c + Math.sin(a) * s * 0.2} L ${c + Math.cos(a) * s * 0.29} ${c + Math.sin(a) * s * 0.29} `;
      }
      return (
        <Group>
          <Circle cx={c} cy={c} r={s * 0.13} color={ink} />
          <Path path={rays} color={ink} style="stroke" strokeWidth={s * 0.05} strokeCap="round" />
        </Group>
      );
    }
    case 'stars':
      return <Path path={star(c, s * 0.27, s * 0.12)} color={ink} />;
    case 'craft':
      return (
        <Group>
          <Path path={`M ${c - s * 0.22} ${c - s * 0.06} L ${c - s * 0.1} ${c - s * 0.2} L ${c + s * 0.1} ${c - s * 0.2} L ${c + s * 0.22} ${c - s * 0.06} L ${c} ${c + s * 0.24} Z`} color={ink} />
          <Path path={`M ${c - s * 0.22} ${c - s * 0.06} L ${c + s * 0.22} ${c - s * 0.06} M ${c - s * 0.07} ${c - s * 0.06} L ${c} ${c + s * 0.24} L ${c + s * 0.07} ${c - s * 0.06}`} color={theme.colors.surfaceHi} style="stroke" strokeWidth={Math.max(1, s * 0.025)} opacity={0.6} />
        </Group>
      );
    default:
      // The long road: a pennant on a pole.
      return (
        <Group>
          <Path path={`M ${c - s * 0.12} ${c + s * 0.24} L ${c - s * 0.12} ${c - s * 0.24}`} color={ink} style="stroke" strokeWidth={s * 0.055} strokeCap="round" />
          <Path path={`M ${c - s * 0.1} ${c - s * 0.24} L ${c + s * 0.22} ${c - s * 0.13} L ${c - s * 0.1} ${c - s * 0.01} Z`} color={ink} />
        </Group>
      );
  }
}

/**
 * An achievement's medal. A game's achievements wear that game's own
 * emblem; the rest a struck medal with their group's glyph. Not yet
 * earned, the medal is an empty outline - the shape of what is coming.
 */
export function AchievementMedal({ achievement, earned, size }: { achievement: Achievement; earned: boolean; size: number }): React.JSX.Element {
  if (achievement.game) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: earned ? 1 : 0.32 }}>
        <GameEmblem kind={achievement.game} size={size} />
      </View>
    );
  }
  const s = size;
  const c = s / 2;
  const tone = groupTone(achievement.group);
  return (
    <Canvas style={{ width: s, height: s }}>
      {earned ? (
        <Group>
          <Circle cx={c} cy={c + s * 0.03} r={c * 0.94} color={theme.colors.towersShadow} />
          <Circle cx={c} cy={c} r={c * 0.94} color={tone} />
          <Circle cx={c} cy={c} r={c * 0.76} color={theme.colors.surfaceHi} opacity={0.22} style="stroke" strokeWidth={Math.max(1, s * 0.04)} />
          <Glyph group={achievement.group} s={s} ink={theme.colors.surfaceHi} />
        </Group>
      ) : (
        <Group>
          <Circle cx={c} cy={c} r={c * 0.9} color={theme.colors.surfaceAlt} />
          <Circle cx={c} cy={c} r={c * 0.9} color={theme.colors.border} style="stroke" strokeWidth={Math.max(1, s * 0.035)} />
          <Glyph group={achievement.group} s={s} ink={theme.colors.textTertiary} />
        </Group>
      )}
    </Canvas>
  );
}
