import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { GLASS_LESSON_WINDOW as WINDOW, GlassPuzzle, GlassState } from '../game/glass';
import { GlassStill } from './GlassBoard';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';

/**
 * Stained Glass's help pictures, drawn by the board itself on the lesson's
 * small window, so the help shows exactly what the game looks like.
 */
const SIZE = ILLUSTRATION_HEIGHT - 8;

/** The lesson window with a vine on it: the centre and the top left
 * pane are its leaf panes. */
const VINE_WINDOW: GlassPuzzle = { ...WINDOW, given: [null, 1, 2, 0, null], vines: [[4, 0]] };

function Window({ colors, ring, puzzle = WINDOW }: { colors: GlassState['colors']; ring?: number; puzzle?: GlassPuzzle }): React.JSX.Element {
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - SIZE) / 2 }, { translateY: (ILLUSTRATION_HEIGHT - SIZE) / 2 }]}>
      <GlassStill puzzle={puzzle} colors={colors} size={SIZE} ring={ring} />
    </Group>
  );
}

export function renderGlassIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'clash':
      // The lower left set ruby beside the ruby above it: both ringed red.
      return <Window colors={[0, 1, 0, null, 2]} />;
    case 'finish':
      return <Window colors={WINDOW.solution} />;
    case 'leaf':
      // The centre touches ruby, cobalt and amber: of its vine, it is the
      // emerald one - so the top left pane is not, and touches cobalt and
      // amber: ruby.
      return <Window puzzle={VINE_WINDOW} colors={[0, 1, 2, 0, 3]} ring={4} />;
    default:
      // The centre, the one pane ready to be set.
      return <Window colors={WINDOW.given} ring={4} />;
  }
}
