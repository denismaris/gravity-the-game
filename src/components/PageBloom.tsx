import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Path, Rect } from '@shopify/react-native-skia';
import { theme, nightTone } from '../theme';
import { blossomPath, leafPath } from './AlmanacBackdrop';
import { useEquipped } from '../progression/PlayerProgressProvider';

/**
 * The `bloom` poster's footer, for every page that is not Home.
 *
 * Home carries the full composition around its card (`AlmanacBackdrop`).
 * A play screen cannot: the board is the subject there and must not share
 * the field with a bouquet. So this keeps to the two bottom corners only -
 * a cropped blossom with its stalk and leaf bottom-left, the dome on
 * stacked rules bottom-right - the same shapes, the same flat full-strength
 * ink, the same hard crop by the sheet's edge, so moving between Home and a
 * game reads as turning pages of one print rather than changing apps.
 *
 * The centre of the bottom edge is left clear on purpose: that is where
 * every screen's Hint/Undo/Restart pills sit. Rendered first in a screen,
 * absolutely, behind everything, and never touchable.
 */
export function PageBloom(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const art = useMemo(() => composeFooter(width, height), [width, height]);
  const ink = theme.colors.artInk;
  // The blossom's colour is the player's page art (see the shop).
  const bloom = nightTone(useEquipped('garden').colors[0] ?? theme.colors.secondary);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={art.stem} color={ink} style="stroke" strokeWidth={art.stemWidth} strokeCap="round" />
        {art.leaves.map((d, i) => (
          <Path key={`leaf-${i}`} path={d} color={ink} />
        ))}
        <Path path={art.blossom} color={bloom} />
        <Path path={art.dome} color={ink} />
        {art.rules.map((r, i) => (
          <Rect key={`rule-${i}`} x={r.x} y={r.y} width={r.width} height={r.height} color={ink} />
        ))}
        <Circle cx={art.disc.cx} cy={art.disc.cy} r={art.disc.r} color={ink} />
      </Canvas>
    </View>
  );
}

/** Exported for its tests. Everything scales off the screen width, and is
 * anchored to the bottom edge. */
export function composeFooter(width: number, height: number) {
  const u = width / 402;

  // Enough of the blossom on the page to read as a flower - cropped so far
  // into the corner that only a sliver showed, it read as a stray blot.
  const blossom = blossomPath(24 * u, height - 34 * u, 64 * u, 7, 37, 0.1);
  // A stalk rising out of the blossom up the left margin, kept left of the
  // pill row (the nearest pill starts ~85pt in, ~156pt up), with a leaf
  // either side of it.
  const stem = `M ${62 * u} ${height + 10} C ${74 * u} ${height - 50 * u}, ${38 * u} ${height - 112 * u}, ${54 * u} ${height - 172 * u}`;
  const leaves = [
    leafPath(48 * u, height - 128 * u, 10 * u, height - 184 * u, 12 * u),
    leafPath(66 * u, height - 70 * u, 104 * u, height - 104 * u, 10 * u),
  ];

  const domeR = 40 * u;
  const domeCx = width - 22 * u;
  const domeBase = height - 44 * u;
  const dome = `M ${domeCx - domeR} ${domeBase} A ${domeR} ${domeR} 0 0 1 ${domeCx + domeR} ${domeBase} Z`;
  const ruleH = 6 * u;
  const ruleX = domeCx - domeR - 30 * u;
  const rules = [0, 1, 2].map(i => ({
    x: ruleX,
    y: domeBase + 8 * u + i * (ruleH + 7 * u),
    width: width - ruleX + 10,
    height: ruleH,
  }));
  const disc = { cx: ruleX + 4 * u, cy: domeBase - 22 * u, r: 9 * u };

  return { blossom, stem, leaves, stemWidth: Math.max(4, 6 * u), dome, rules, disc };
}
