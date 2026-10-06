import React from 'react';
import { Text, View } from 'react-native';
import { canBuild, currentVilla, PIECES_PER_VILLA, usePlayerProgress } from '../progression';
import { useAppearance } from '../settings';
import { theme, themedStyles } from '../theme';
import { PressableScale } from './PressableScale';
import { TileGlyph } from './TileGlyph';
import { VillaIsland } from './villa/VillaIsland';

/**
 * The villa on Home: the island itself, whole and floating on the page in
 * front of its big blossom - no frame, no crop - beside its name, how far
 * along it is, and a Build button when there is something to build. One
 * tap opens the Villas.
 */
export function VillaBanner({ width, height, onOpen }: { width: number; height: number; onOpen?: () => void }): React.JSX.Element {
  const { progress } = usePlayerProgress();
  const night = useAppearance() === 'dark';
  const { plan, built } = currentVilla(progress);
  const ready = canBuild(progress);
  const islandWidth = Math.min(width * 0.5, height * 1.25);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${plan.name}, ${built} of ${PIECES_PER_VILLA} built, ${progress.tesserae} tiles${ready ? '. Something is ready to build' : ''}. Open your villas`}
      onPress={onOpen}
      scaleTo={0.98}
      style={[styles.row, { width, height }]}
    >
      <View style={styles.text}>
        <Text style={styles.kicker}>Your villa</Text>
        <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {plan.name}
        </Text>
        <View style={styles.track}>
          {plan.pieces.map((p, i) => (
            <View key={p.id} style={[styles.cell, i < built && styles.cellOn]} />
          ))}
        </View>
        {ready ? (
          <View style={styles.build}>
            <Text style={styles.buildText}>Build now</Text>
          </View>
        ) : (
          <View style={styles.tiles}>
            <TileGlyph size={12} />
            <Text style={styles.tilesText}>{`${progress.tesserae} tiles`}</Text>
          </View>
        )}
      </View>
      {/* On the right, floating in front of the page's big blossom. */}
      <VillaIsland plan={plan} built={built} width={islandWidth} height={height} night={night} />
    </PressableScale>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, paddingRight: 4, gap: 5 },
  kicker: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  name: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  track: { flexDirection: 'row', gap: 3, marginTop: 2 },
  cell: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.border },
  cellOn: { backgroundColor: theme.colors.secondary },
  build: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  buildText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tilesText: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
}));
