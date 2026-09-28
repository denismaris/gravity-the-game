import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { accentColorForKind, gameLabelForKind } from '../game/journey';
import { hexToRgb } from '../game/rendering';
import { GameEmblem } from './GameEmblem';
import { GameAptitude } from '../progression';
import { theme } from '../theme';

export interface AptitudeChartProps {
  readonly games: ReadonlyArray<GameAptitude>;
  /** Outer size of the square the whole chart occupies, marks included. */
  readonly size: number;
}

/**
 * How much of the half-size the plotted web takes, leaving the rest for
 * the marks ringing it.
 *
 * The binding constraint is the two marks at due left and due right:
 * they need `webRadius + MARK_GAP + MARK_SIZE / 2` to stay inside the
 * chart's own box, and with eight axes there is always a vertex exactly
 * there. Square marks are what make this generous - the first version
 * ringed the web with the games' names, and "Fill-a-Pix" at due left
 * needed so much horizontal room that the whole chart had to be 268
 * points wide before the web could be any size at all, which in turn
 * made this the tallest card on the home screen by a wide margin.
 */
const WEB_FRACTION = 0.7;

/** Clear air between the web's outer ring and the marks around it. */
const MARK_GAP = 10;
const MARK_SIZE = 24;

/** The rings, as fractions of the full radius. Four, not more: this is a
 * shape to read at a glance, and a dense graticule turns it into a
 * measuring instrument the player has to decode. */
const RINGS: ReadonlyArray<number> = [0.25, 0.5, 0.75, 1];

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Vertex `index` of `count`, at `radius`, starting at the top and going
 * clockwise - so the first game in the lineup sits at twelve o'clock
 * rather than at three, where a bare `cos/sin` would put it. */
function vertex(centre: number, radius: number, index: number, count: number): Point {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) };
}

function polygon(points: ReadonlyArray<Point>): string {
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;
}

/**
 * The player's shape: one axis per game, each plotted by how cleanly that
 * game's puzzles have gone.
 *
 * A radar rather than eight bars because the thing worth seeing here is
 * the *shape* - whether you are evenly good across the app or spiky, and
 * which way the spikes point. Eight bars answer "how good at Binairo" one
 * at a time; this answers "what kind of solver am I" in one look, which is
 * the only reason to draw a chart on a home screen at all.
 *
 * Each axis is labelled with that game's own emblem, absolutely
 * positioned at the same polar coordinates the Skia vertices use. The
 * emblems are what identify a game everywhere else in the app - the
 * Continue card names them right next to their marks - so the chart reads
 * without eight pieces of small text crowding the web.
 */
export function AptitudeChart({ games, size }: AptitudeChartProps): React.JSX.Element {
  const centre = size / 2;
  const webRadius = centre * WEB_FRACTION;
  const count = games.length;

  const web = RINGS.map(ring =>
    polygon(games.map((_, i) => vertex(centre, webRadius * ring, i, count))),
  );
  const spokes = games
    .map((_, i) => {
      const point = vertex(centre, webRadius, i, count);
      return `M ${centre} ${centre} L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ');

  // An untested game plots at the centre, which is honest - there is no
  // evidence either way - but a vertex pinned to zero drags the whole
  // shape inward and reads as a weakness rather than a blank. The floor
  // keeps the outline legible while still sitting clearly below every
  // real score.
  const plotted = games.map((game, i) =>
    vertex(centre, webRadius * (game.tested ? Math.max(game.precision, 0.06) : 0.06), i, count),
  );

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {web.map((ring, i) => (
          <Path
            key={`ring-${i}`}
            path={ring}
            color={i === RINGS.length - 1 ? theme.colors.borderStrong : theme.colors.border}
            style="stroke"
            strokeWidth={i === RINGS.length - 1 ? 1.4 : 1}
          />
        ))}
        <Path path={spokes} color={theme.colors.border} style="stroke" strokeWidth={1} />

        <Path path={polygon(plotted)} color={rgba(theme.colors.secondary, 0.22)} />
        <Path
          path={polygon(plotted)}
          color={theme.colors.secondary}
          style="stroke"
          strokeWidth={2}
          strokeJoin="round"
        />
        {plotted.map((point, i) => (
          <Circle
            key={`node-${i}`}
            cx={point.x}
            cy={point.y}
            r={3.2}
            color={games[i].tested ? accentColorForKind(games[i].kind) : theme.colors.border}
          />
        ))}
      </Canvas>

      {games.map((game, i) => {
        const at = vertex(centre, webRadius + MARK_GAP + MARK_SIZE / 2, i, count);
        return (
          <View
            key={game.kind}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${gameLabelForKind(game.kind)}: ${
              game.tested ? `${Math.round(game.precision * 100)} percent` : 'not played yet'
            }`}
            style={[
              styles.mark,
              !game.tested && styles.markUntested,
              { left: at.x - MARK_SIZE / 2, top: at.y - MARK_SIZE / 2 },
            ]}
          >
            <GameEmblem kind={game.kind} size={MARK_SIZE} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * A mark at due left must satisfy
 * `WEB_FRACTION * centre + MARK_GAP + MARK_SIZE <= centre`, which at these
 * values needs `centre >= 74` - a chart of 148 points or more. Home hands
 * it far more than that at every width the app supports. Change any of
 * the three and check that inequality again.
 */
const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  /** A game with no solves behind it. Held back rather than hidden: the
   * axis is still there and still named, it just has nothing to say yet. */
  markUntested: {
    opacity: 0.3,
  },
});
