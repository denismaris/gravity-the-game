import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLevelById, LevelDefinition } from '../game/levels';
import { WORLDS } from '../game/worlds';
import {
  getResumePoint,
  getWorldSummary,
  usePlayerProgress,
  WorldLevelSummary,
  WorldSummary,
} from '../progression';
import { StarRow } from '../components';
import { theme } from '../theme';

export interface LevelSelectScreenProps {
  /** Called with the chosen level. The resume cursor is updated first. */
  onSelectLevel: (level: LevelDefinition) => void;
}

interface Section {
  worldId: string;
  order: number;
  summary: WorldSummary;
  data: ReadonlyArray<WorldLevelSummary>;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * World + level select.
 *
 * One scrollable list of worlds; each world is a section with its own level
 * rows. A row shows its number, its name, and either the stars earned or a
 * lock. Completing a level unlocks the next one in the same world - but all
 * of that is decided by the pure `worldProgress` selectors; this screen only
 * renders their output. Locked rows are inert.
 */
export function LevelSelectScreen({ onSelectLevel }: LevelSelectScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress, totalStars, markLevelOpened } = usePlayerProgress();

  const sections = useMemo<Section[]>(
    () =>
      WORLDS.map(world => {
        const summary = getWorldSummary(progress, world);
        return {
          worldId: world.id,
          order: world.order,
          summary,
          data: summary.unlocked ? summary.levels : [],
        };
      }),
    [progress],
  );

  const resume = useMemo(() => getResumePoint(progress), [progress]);
  const totalPossible = useMemo(
    () => WORLDS.reduce((sum, w) => sum + w.levelIds.length * 3, 0),
    [],
  );

  const openLevel = (levelId: string, worldId: string): void => {
    const level = getLevelById(levelId);
    if (!level) return;
    markLevelOpened(levelId, worldId);
    onSelectLevel(level);
  };

  return (
    <SectionList<WorldLevelSummary, Section>
      style={styles.container}
      sections={sections}
      keyExtractor={item => item.levelId}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xl,
        },
      ]}
      ListHeaderComponent={
        <View style={styles.appHeader}>
          <Text style={styles.wordmark}>GRAVITY</Text>
          <Text style={styles.totalStars}>
            {'★ '}
            <Text style={styles.totalStarsValue}>{totalStars}</Text>
            {` / ${totalPossible}`}
          </Text>
        </View>
      }
      renderSectionHeader={({ section }) => <WorldHeader summary={section.summary} order={section.order} />}
      renderSectionFooter={({ section }) =>
        section.summary.unlocked ? null : (
          <Text style={styles.lockedWorldNote}>
            Complete the previous world to unlock these levels.
          </Text>
        )
      }
      renderItem={({ item, section }) => (
        <LevelRow
          summary={item}
          isResume={resume.levelId === item.levelId && item.unlocked && !item.completed}
          onPress={() => openLevel(item.levelId, section.worldId)}
        />
      )}
    />
  );
}

interface WorldHeaderProps {
  summary: WorldSummary;
  order: number;
}

function WorldHeader({ summary, order }: WorldHeaderProps): React.JSX.Element {
  return (
    <View style={styles.worldHeader}>
      <View style={styles.worldHeaderTop}>
        <Text style={styles.worldKicker}>WORLD {order}</Text>
        {!summary.unlocked && <Text style={styles.worldLock}>{'🔒'}</Text>}
      </View>
      <Text style={styles.worldName}>{summary.name.toUpperCase()}</Text>
      {summary.unlocked && (
        <Text style={styles.worldMeta}>
          {summary.completedLevels}/{summary.totalLevels} levels
          {'   ·   ★ '}
          {summary.starsEarned}/{summary.starsPossible}
        </Text>
      )}
    </View>
  );
}

interface LevelRowProps {
  summary: WorldLevelSummary;
  isResume: boolean;
  onPress: () => void;
}

const LevelRow = React.memo(function LevelRowImpl({
  summary,
  isResume,
  onPress,
}: LevelRowProps): React.JSX.Element {
  const { position, name, unlocked, completed, stars } = summary;

  if (!unlocked) {
    return (
      <View
        style={[styles.row, styles.rowLocked]}
        accessible
        accessibilityLabel={`Level ${position}, locked`}
      >
        <Text style={[styles.rowNumber, styles.rowNumberLocked]}>{pad2(position)}</Text>
        <View style={styles.rowBody} />
        <Text style={styles.lock}>{'🔒'}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play level ${position}: ${name}${
        completed ? `, ${stars} of 3 stars` : ''
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isResume && styles.rowResume,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.rowNumber, completed && styles.rowNumberDone]}>{pad2(position)}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        {isResume && <Text style={styles.rowResumeLabel}>Continue</Text>}
      </View>
      <StarRow earned={stars} size={15} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  wordmark: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
  },
  totalStars: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
  },
  totalStarsValue: {
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.bold,
  },
  worldHeader: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  worldHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  worldKicker: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
  },
  worldLock: {
    fontSize: theme.typography.sizes.caption,
  },
  worldName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    marginTop: 2,
  },
  worldMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.caption,
    marginTop: theme.spacing.xs,
  },
  lockedWorldNote: {
    color: theme.colors.textDisabled,
    fontSize: theme.typography.sizes.caption,
    marginTop: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  rowResume: {
    borderColor: theme.colors.primary,
  },
  rowLocked: {
    opacity: 0.45,
  },
  rowNumber: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
  },
  rowNumberDone: {
    color: theme.colors.textPrimary,
  },
  rowNumberLocked: {
    color: theme.colors.textDisabled,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  rowResumeLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    marginTop: 2,
  },
  lock: {
    fontSize: theme.typography.sizes.body,
  },
});
