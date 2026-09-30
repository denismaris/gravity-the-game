import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Group, Path, RoundedRect, rect, rrect } from '@shopify/react-native-skia';
import { useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import {
  ACTS,
  actProgress,
  easeInOut,
  easeOut,
  launchPieces,
  LaunchPiece,
  letterProgress,
  pieceOpacity,
  piecePointsAt,
  pieceProgress,
  sheenBandPoints,
  sheenOpacity,
  sheenTravel,
  TOTAL_MS,
} from './launchChoreography';

export interface LaunchSequenceProps {
  /** Whether the app behind this has finished loading. The sequence always
   * plays its full beat, but it will hold on the finished tile rather than
   * hand off to a half-loaded screen. */
  readonly appReady: boolean;
  /** Called once, when the sequence is over and the layer can unmount. */
  readonly onDone: () => void;
}

const WORDMARK = 'TESSERA';

/**
 * The app's mark, building itself.
 *
 * A magenta tessera arrives, eighteen pieces of tilework fly in and lock
 * into the star-and-cross of the app icon, the wordmark sets beneath it
 * letter by letter, and the tile lifts away to Home. Timing and geometry
 * live in `launchChoreography.ts`; this file is only the rendering.
 *
 * It sits on the app's own paper colour, which is also what the native
 * launch screen is set to, so there is no flash between the two - the
 * static launch image simply becomes this.
 *
 * Three things keep it from being a tax on every cold start: it is under
 * two seconds, a tap anywhere skips it, and it is skipped outright under
 * reduced motion (where it degrades to a short cross-fade - the point of
 * that setting is not to watch things fly around).
 */
export function LaunchSequence({ appReady, onDone }: LaunchSequenceProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [skipped, setSkipped] = useState(false);

  const pieces = useMemo(() => launchPieces(), []);
  // Stops asking for new frames once the choreography has actually
  // finished playing (`elapsed` itself, not a fixed duration, so this
  // reacts the frame it happens rather than a render late) - without it,
  // the clock kept ticking at 60fps for as long as `appReady` took to
  // resolve, which is normally milliseconds but is not guaranteed to be,
  // and every one of those frames was recomputing eighteen already-
  // finished pieces for a screen that had stopped changing. The one extra
  // tick this lags by is `useAnimationClock`'s own documented behaviour -
  // it freezes at its last value once inactive, so nothing here has to
  // worry about `elapsed` itself going stale.
  const finishedPlayingRef = useRef(false);
  const running = !skipped && !reducedMotion && !finishedPlayingRef.current;
  const elapsed = useAnimationClock(running);
  if (elapsed >= TOTAL_MS) finishedPlayingRef.current = true;

  // Under reduced motion there is nothing to watch, so the layer exists
  // only long enough to cover the providers' first load.
  const effectiveElapsed = skipped || reducedMotion ? TOTAL_MS : elapsed;

  const side = Math.min(width, height) * 0.46;
  const half = side / 2;
  const cx = width / 2;
  const cy = height * 0.42;

  // `easeOut`, not `easeInOut`: this is the very first thing drawn on a
  // cold start, appearing from nothing, and every other entrance in this
  // app (`motion.cardEnter.easing`, every piece's own `pieceProgress`,
  // each wordmark letter's `letterProgress`) fades in on that same
  // fast-start curve. `easeInOut` was tried here first and reads as a
  // stall: its cubic ease-in holds the tile under 10% opacity for
  // roughly the first third of `ACTS.tileIn`, so the app appears to hang
  // for a beat before the tile "pops" in - exactly the wrong first
  // impression for a cold start. `handoff` keeps `easeInOut` on purpose:
  // that is a crossfade between two already-visible things, where both
  // ends genuinely matter, not an appearance from nothing.
  const tile = easeOut(actProgress(effectiveElapsed, ACTS.tileIn));
  const handoff = easeInOut(actProgress(effectiveElapsed, ACTS.handoff));

  // The tile's own square bounding box, plain corners rather than
  // matching `RoundedRect`'s rounding - a hand-written arc path risks
  // getting a sweep flag wrong in exactly the way this app has been
  // burned by before (see `RestartIcon`'s own comment on that), for a
  // difference that would only ever show as a sliver of the sheen's own
  // soft white poking a fraction past a rounded corner, for a couple of
  // frames, while it is already fading in or out. Not worth the risk.
  const tileClipPath = useMemo(() => `M ${-half} ${-half} L ${half} ${-half} L ${half} ${half} L ${-half} ${half} Z`, [half]);
  // The pieces, though, are clipped to the true rounded silhouette: they
  // slide in from under the tile's edge, and a satellite arriving on a
  // diagonal would otherwise show a chalk corner hanging off the tile.
  const tileClipRRect = useMemo(() => rrect(rect(-half, -half, side, side), side * 0.225, side * 0.225), [half, side]);
  const sheenPath = useMemo(() => {
    const points = sheenBandPoints(sheenTravel(effectiveElapsed));
    return `${points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${(x * half).toFixed(2)} ${(y * half).toFixed(2)}`)
      .join(' ')} Z`;
  }, [effectiveElapsed, half]);

  // The layer's own fade, driven by RN rather than the clock so it keeps
  // running on the native thread even as the JS thread takes the first
  // render of Home.
  const cover = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  useEffect(() => {
    // Hold on the assembled tile until the app behind is actually ready -
    // handing off to a screen still resolving its own storage read is the
    // one thing that would make this feel like a loading spinner.
    if (finishedRef.current) return;
    if (effectiveElapsed < ACTS.handoff.start || !appReady) return;
    finishedRef.current = true;
    Animated.timing(cover, {
      toValue: 0,
      duration: ACTS.handoff.end - ACTS.handoff.start,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [effectiveElapsed, appReady, cover, onDone]);

  const skip = useCallback(() => setSkipped(true), []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.layer,
        { opacity: cover, transform: [{ scale: cover.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] },
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip the opening animation"
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Group
            transform={[
              { translateX: cx },
              { translateY: cy },
              { scale: 0.86 + 0.14 * tile + 0.10 * handoff },
            ]}
            opacity={tile * (1 - handoff)}
          >
            <RoundedRect
              x={-half}
              y={-half}
              width={side}
              height={side}
              r={side * 0.225}
              color={theme.colors.brandTile}
            />
            <Group clip={tileClipRRect}>
              {pieces.map((piece, i) => (
                <Piece key={i} piece={piece} half={half} progress={pieceProgress(effectiveElapsed, piece)} />
              ))}
            </Group>
            {/* The glow: "the star is fully done and built" gets the same
                diagonal light sweep every completion card in this app
                plays once its own contents have settled - clipped to the
                tile's own rounded silhouette, on top of the finished
                pieces, so it reads as light catching a glazed surface
                rather than a shape drawn over it. */}
            <Group clip={tileClipPath}>
              <Path
                path={sheenPath}
                color="rgba(255,255,255,0.55)"
                opacity={sheenOpacity(effectiveElapsed)}
              />
            </Group>
          </Group>
        </Canvas>

        {/* RN text, not Skia: no Skia font is bundled in this app. Each
            letter is its own node so they can set one after another, which
            is also what lets the whole thing use the native driver. */}
        <View style={[styles.wordmarkRow, { top: cy + half + theme.spacing.xl }]} pointerEvents="none">
          {WORDMARK.split('').map((ch, i) => {
            const p = letterProgress(effectiveElapsed, i, WORDMARK.length) * (1 - handoff);
            return (
              <Text
                key={i}
                style={[
                  styles.wordmark,
                  { opacity: p, transform: [{ translateY: (1 - p) * 14 }] },
                ]}
              >
                {ch}
              </Text>
            );
          })}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * One piece of tilework, sliding in along its own vector and turning
 * upright about its own centre as it lands (see `piecePointsAt`). The polygon is rebuilt from scratch every frame it
 * is actually moving - eighteen short point lists is nothing next to the
 * Skia draw itself.
 *
 * `React.memo`'d specifically so a piece stops paying that cost once it
 * isn't moving any more: `progress` is `easeOut`'s own output, which is
 * an exact, stable `0` for the roughly-half of the assemble act a piece
 * hasn't been released into yet, and an exact, stable `1` for the rest of
 * the sequence once it has landed - only genuinely mid-flight does it
 * change frame to frame. `piece` and `half` are already stable across
 * the whole animation (a memoized array and the window's own size), so
 * this bails out correctly on every frame that isn't this piece's own
 * flight, which for any single piece is most of the roughly two seconds
 * eighteen of these are otherwise all re-rendering in lockstep.
 */
const Piece = React.memo(function PieceImpl({
  piece,
  half,
  progress,
}: {
  piece: LaunchPiece;
  half: number;
  progress: number;
}): React.JSX.Element | null {
  if (progress <= 0) return null;

  const path = piecePointsAt(piece, progress)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${(x * half).toFixed(2)} ${(y * half).toFixed(2)}`)
    .join(' ');

  return <Path path={`${path} Z`} color={piece.color} opacity={pieceOpacity(progress)} />;
});

const styles = themedStyles(() => ({
  layer: {
    backgroundColor: theme.colors.background,
    zIndex: 100,
  },
  wordmarkRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: theme.typography.tracking.wordmark,
    color: theme.colors.textPrimary,
  },
}));

