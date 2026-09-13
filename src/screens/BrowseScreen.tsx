import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { BINAIRO } from '../game/binairo';
import { CONSTELLATIONS } from '../game/constellation';
import { accentColorForKind, GameKind } from '../game/journey';
import { MIRROR_MAZES } from '../game/mirror';
import { SUDOKUS } from '../game/sudoku';
import { TENTS_TREES } from '../game/tents';
import { TOWERS } from '../game/towers';
import { TRAJECTORIES } from '../game/trajectory';
import { getAllWorldSummaries, usePlayerProgress, WorldSummary } from '../progression';
import { StarRating } from '../game/scoring';
import { theme } from '../theme';

export interface BrowseScreenProps {
  /** Return to the hub. */
  onExit: () => void;
  /** Open a specific puzzle directly, bypassing the Journey's own ordering. */
  onOpen: (kind: GameKind, puzzleId: string) => void;
}

/** A puzzle from one of the flat (no lock, no world) pools, reduced to what
 * a tile needs to render. */
interface FlatTile {
  readonly puzzleId: string;
  readonly position: number;
  readonly stars: 0 | StarRating;
}

/** One flat (no lock, no world) game's section: a label and its pool. Every
 * such section renders identically (see the `.map` below), so adding a new
 * flat-pool game only ever means adding one row here, not a new hand-copied
 * block of JSX. */
interface FlatPoolSection {
  readonly kind: GameKind;
  readonly label: string;
  readonly pool: ReadonlyArray<{ id: string }>;
}

const FLAT_POOL_SECTIONS: ReadonlyArray<FlatPoolSection> = [
  { kind: 'constellation', label: 'CONSTELLATION', pool: CONSTELLATIONS },
  { kind: 'trajectory', label: 'TRAJECTORY', pool: TRAJECTORIES },
  { kind: 'sudoku', label: 'SUDOKU', pool: SUDOKUS },
  { kind: 'mirror', label: 'MIRROR MAZE', pool: MIRROR_MAZES },
  { kind: 'tents', label: 'TENTS AND TREES', pool: TENTS_TREES },
  { kind: 'towers', label: 'SKYSCRAPERS', pool: TOWERS },
  { kind: 'binairo', label: 'BINAIRO', pool: BINAIRO },
];

/**
 * Every puzzle in the game, organised by world (Gravity) or as a flat
 * numbered grid (Constellation/Trajectory/Sudoku, which have no lock
 * concept), with stars shown for whatever's already completed. This is a
 * second way to reach any puzzle - it does not replace the Journey's own
 * "Continue"/"Daily" flow on Home, and picking a puzzle here does not change
 * Journey position or the Daily pick.
 *
 * Gravity's lock state is the *existing* rule surfaced for the first time,
 * not a new one: `getAllWorldSummaries`/`isWorldUnlocked` already governed
 * unlocking before there was any level-select screen to show it on. The
 * other three games have never had a lock rule, so their tiles are always
 * open - adding one here would be new gameplay logic, not a display of
 * something that already existed, so this deliberately doesn't.
 */
export function BrowseScreen({ onExit, onOpen }: BrowseScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress, levelStars } = usePlayerProgress();

  const worlds = getAllWorldSummaries(progress);
  const flatTiles = (pool: ReadonlyArray<{ id: string }>): FlatTile[] =>
    pool.map((puzzle, index) => ({
      puzzleId: puzzle.id,
      position: index + 1,
      stars: levelStars(puzzle.id),
    }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>All Puzzles</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.gameLabel}>GRAVITY</Text>
        {worlds.map(world => (
          <WorldSection key={world.worldId} world={world} onOpen={puzzleId => onOpen('gravity', puzzleId)} />
        ))}

        {FLAT_POOL_SECTIONS.map(section => (
          <React.Fragment key={section.kind}>
            <Text style={[styles.gameLabel, { color: accentColorForKind(section.kind) }]}>{section.label}</Text>
            <TileGrid tiles={flatTiles(section.pool)} onOpen={puzzleId => onOpen(section.kind, puzzleId)} />
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

interface WorldSectionProps {
  world: WorldSummary;
  onOpen: (puzzleId: string) => void;
}

function WorldSection({ world, onOpen }: WorldSectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionTitle}>{world.name}</Text>
        <Text style={styles.sectionMeta}>
          {world.completedLevels} of {world.totalLevels}
        </Text>
      </View>

      {world.unlocked ? (
        <View style={styles.grid}>
          {world.levels.map(level => (
            <Tile
              key={level.levelId}
              position={level.position}
              stars={level.stars}
              locked={!level.unlocked}
              onPress={() => onOpen(level.levelId)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.lockedNote}>Locked - complete the world before this one first.</Text>
      )}
    </View>
  );
}

interface TileGridProps {
  tiles: ReadonlyArray<FlatTile>;
  onOpen: (puzzleId: string) => void;
}

function TileGrid({ tiles, onOpen }: TileGridProps): React.JSX.Element {
  return (
    <View style={[styles.section, styles.grid]}>
      {tiles.map(tile => (
        <Tile
          key={tile.puzzleId}
          position={tile.position}
          stars={tile.stars}
          locked={false}
          onPress={() => onOpen(tile.puzzleId)}
        />
      ))}
    </View>
  );
}

interface TileProps {
  position: number;
  stars: 0 | StarRating;
  locked: boolean;
  onPress: () => void;
}

function Tile({ position, stars, locked, onPress }: TileProps): React.JSX.Element {
  const completed = stars > 0;
  return (
    <PressableScale
      disabled={locked}
      feedback={!locked}
      accessibilityRole="button"
      accessibilityLabel={
        locked ? `Level ${position}, locked` : `Level ${position}${completed ? `, ${stars} star${stars === 1 ? '' : 's'}` : ''}`
      }
      style={[styles.tile, completed && styles.tileDone, locked && styles.tileLocked]}
      onPress={onPress}
    >
      <Text style={[styles.tileNumber, locked && styles.tileNumberLocked]}>{position}</Text>
      {completed && <Text style={styles.tileStars}>{'★'.repeat(stars)}</Text>}
    </PressableScale>
  );
}

const TILE_SIZE = 46;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56 },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  gameLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.secondary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  sectionMeta: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.textTertiary,
  },
  lockedNote: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDone: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.accent,
  },
  tileLocked: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    opacity: 0.5,
  },
  tileNumber: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  tileNumberLocked: {
    color: theme.colors.textDisabled,
  },
  tileStars: {
    fontSize: 9,
    color: theme.colors.accent,
    marginTop: 1,
  },
});
