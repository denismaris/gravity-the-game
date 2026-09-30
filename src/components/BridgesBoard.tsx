import React, { useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { BridgesPuzzle, BridgesState, bridgeLinks, canBuild, islandLoads, linkFrom } from '../game/bridges';
import { triggerHaptic, useScreenReader } from '../game/rendering';
import { BridgesBoardView, BridgesDrag, BridgesGeometry, bridgesGeometry, laneShare } from './BridgesBoardView';

export interface BridgesBoardProps {
  puzzle: BridgesPuzzle;
  state: BridgesState;
  size: number;
  solved: boolean;
  /** A bridge dragged out from `island` along `link`. */
  onLane: (link: number, island: number) => void;
  /** The water between two islands tapped, `at` (0-1) of the way along
   * the lane - one more bridge there, or back to none. */
  onTapLane: (link: number, at: number) => void;
  origin?: { link: number; at: number } | null;
  flashLink?: number | null;
  blocked?: { link: number; at: number } | null;
  introKey?: number;
  /** A screen reader's swipe up or down on a lane: one bridge more (+1)
   * or fewer (-1). Only reachable with VoiceOver / TalkBack on. */
  onAdjustLane?: (link: number, delta: 1 | -1) => void;
}

/** How far a finger must travel before a drag picks its direction, and
 * the share of the way to the far island past which letting go lays the
 * bridge - as shares of a square and of the lane. */
const DIRECTION_AT = 0.22;
const SNAP_AT = 0.45;

/**
 * The Skia board with one touch responder over all of it. Two ways to
 * build, both first-class:
 *
 * - **Drag** from an island: its lanes show while the finger is down;
 *   heading along one stretches a ghost bridge after the finger, snapping
 *   (with a tick) past the middle - let go and it is laid, built out from
 *   that island.
 * - **Tap** the water between two islands: a bridge is laid there, built
 *   outward from the very spot tapped to both shores. Tap it again for a
 *   double, once more to clear it.
 *
 * Everything visible is drawn by the canvas; the responder only reads the
 * finger, so a drag re-renders the preview and nothing settled.
 */
export function BridgesBoard({ puzzle, state, size, solved, onLane, onTapLane, origin, flashLink, blocked, introKey, onAdjustLane }: BridgesBoardProps): React.JSX.Element {
  const screenReader = useScreenReader();
  const geo = useMemo(() => bridgesGeometry(puzzle, size), [puzzle, size]);
  const layout = geo.layout;
  const [drag, setDrag] = useState<BridgesDrag | null>(null);
  // Written straight from the finger; the ghost bridge reads it on the UI
  // thread, so a drag re-renders the board only when it changes lane or
  // snaps - not on every touch move.
  const dragProgress = useSharedValue(0);

  // The responder is created once; everything it reads goes through refs.
  const live = useRef({ puzzle, state, geo, solved, onLane, onTapLane });
  live.current = { puzzle, state, geo, solved, onLane, onTapLane };
  const gestureRef = useRef<{ x: number; y: number; island: number | null; lane: { link: number; at: number } | null; drag: BridgesDrag | null }>({
    x: 0,
    y: 0,
    island: null,
    lane: null,
    drag: null,
  });

  const responder = useMemo(() => {
    const cellOf = () => live.current.geo.cell;
    const centre = (i: number) => live.current.geo.centres[i];
    const islandAt = (x: number, y: number): number | null => {
      let best: number | null = null;
      let bestDistance = Math.max(live.current.geo.R * 1.3, cellOf() * 0.46);
      live.current.puzzle.islands.forEach((_island, i) => {
        const c = centre(i);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bestDistance) {
          best = i;
          bestDistance = d;
        }
      });
      return best;
    };
    /** The lane under a point on the water - any lane, built or not. Where
     * two lanes cross, a built one wins (the other could not be built
     * anyway), then whichever line the finger is nearer. */
    const laneAt = (x: number, y: number): { link: number; at: number } | null => {
      const { puzzle: p, state: s, geo: chart } = live.current;
      const slack = cellOf() * 0.36;
      let best: { link: number; at: number; score: number } | null = null;
      for (const link of bridgeLinks(p)) {
        const a = centre(link.a);
        const b = centre(link.b);
        const off = link.horizontal ? Math.abs(y - a.y) : Math.abs(x - a.x);
        const inside = link.horizontal ? x > a.x && x < b.x : y > a.y && y < b.y;
        if (!inside || off > slack) continue;
        const score = off - (s.bridges[link.index] > 0 ? cellOf() : 0);
        if (!best || score < best.score) best = { link: link.index, at: laneShare(chart, link, x, y), score };
      }
      return best ? { link: best.link, at: best.at } : null;
    };
    const update = (next: BridgesDrag | null) => {
      const previous = gestureRef.current.drag;
      if (next?.snapped && !(previous?.snapped && previous.link === next.link)) triggerHaptic('step');
      dragProgress.value = next?.progress ?? 0;
      gestureRef.current.drag = next;
      const same =
        previous !== null &&
        next !== null &&
        previous.source === next.source &&
        previous.link === next.link &&
        previous.snapped === next.snapped &&
        previous.blocked === next.blocked;
      if (!same) setDrag(next);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.solved,
      onMoveShouldSetPanResponder: () => !live.current.solved,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        const { locationX: x, locationY: y } = event.nativeEvent;
        const island = islandAt(x, y);
        gestureRef.current = { x, y, island, lane: island === null ? laneAt(x, y) : null, drag: null };
        if (island !== null) update({ source: island, link: null, progress: 0, snapped: false, blocked: false });
      },
      onPanResponderMove: (_event, gesture) => {
        const g = gestureRef.current;
        if (g.island === null) return;
        const { dx, dy } = gesture;
        const cell = cellOf();
        if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * DIRECTION_AT) {
          if (g.drag?.link !== null) update({ source: g.island, link: null, progress: 0, snapped: false, blocked: false });
          return;
        }
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const dc = horizontal ? Math.sign(dx) : 0;
        const dr = horizontal ? 0 : Math.sign(dy);
        const link = linkFrom(live.current.puzzle, g.island, dc, dr);
        if (link === null) {
          update({ source: g.island, link: null, progress: 0, snapped: false, blocked: false });
          return;
        }
        const { puzzle: p, state: s } = live.current;
        const from = p.islands[g.island];
        const to = bridgeLinks(p)[link];
        const other = p.islands[to.a === g.island ? to.b : to.a];
        const span = (Math.abs(other.col - from.col) + Math.abs(other.row - from.row)) * cell;
        const progress = Math.max(0, Math.min(1, (horizontal ? Math.abs(dx) : Math.abs(dy)) / span));
        const crossed = s.bridges[link] === 0 && !canBuild(p, s, link);
        update({ source: g.island, link, progress, snapped: progress >= SNAP_AT, blocked: crossed });
      },
      onPanResponderRelease: (_event, gesture) => {
        const g = gestureRef.current;
        const moved = Math.hypot(gesture.dx, gesture.dy);
        if (g.drag && g.drag.link !== null && g.drag.snapped && g.island !== null) live.current.onLane(g.drag.link, g.island);
        else if (g.lane !== null && moved < cellOf() * 0.3) live.current.onTapLane(g.lane.link, g.lane.at);
        gestureRef.current = { x: 0, y: 0, island: null, lane: null, drag: null };
        setDrag(null);
      },
      onPanResponderTerminate: () => {
        gestureRef.current = { x: 0, y: 0, island: null, lane: null, drag: null };
        setDrag(null);
      },
    });
    // The shared value is stable for the board's life; everything else is
    // read through `live`.
  }, [dragProgress]);

  return (
    <View
      style={{ width: layout.boardSize, height: layout.boardSize }}
      {...(screenReader ? {} : responder.panHandlers)}
      accessible={!screenReader}
      accessibilityLabel={`Bridges board, ${puzzle.islands.length} islands`}
      accessibilityHint="Drag from an island toward another to lay a bridge. Tap a bridge to double it or take it away."
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <BridgesBoardView
            puzzle={puzzle}
            state={state}
            size={size}
            solved={solved}
            drag={drag}
            dragProgress={dragProgress}
            origin={origin}
            flashLink={flashLink}
            blocked={blocked}
            introKey={introKey}
          />
        </Canvas>
      </View>
      {screenReader && (
        <BridgesAccessibility puzzle={puzzle} state={state} geo={geo} solved={solved} onTapLane={onTapLane} onAdjustLane={onAdjustLane} />
      )}
    </View>
  );
}

/** "row 2, column 5" - one-based, as a person counts. */
function place(island: { row: number; col: number }): string {
  return `row ${island.row + 1}, column ${island.col + 1}`;
}

/**
 * The board as a screen reader meets it: every island an element that
 * reads its number and how many bridges it has, and every lane between
 * two islands an adjustable control - swipe up for one more bridge, down
 * for one fewer, double-tap to cycle as a tap would. Laid over the canvas
 * in the same places, so exploring by touch finds them where they are
 * drawn.
 */
function BridgesAccessibility({
  puzzle,
  state,
  geo,
  solved,
  onTapLane,
  onAdjustLane,
}: {
  puzzle: BridgesPuzzle;
  state: BridgesState;
  geo: BridgesGeometry;
  solved: boolean;
  onTapLane: (link: number, at: number) => void;
  onAdjustLane?: (link: number, delta: 1 | -1) => void;
}): React.JSX.Element {
  const links = bridgeLinks(puzzle);
  const loads = islandLoads(puzzle, state);
  const lane = geo.cell * 0.56;
  return (
    <>
      {links.map((link, i) => {
        const a = geo.centres[link.a];
        const b = geo.centres[link.b];
        const count = state.bridges[i];
        const crossed = count === 0 && !canBuild(puzzle, state, i);
        const from = puzzle.islands[link.a];
        const to = puzzle.islands[link.b];
        const box = link.horizontal
          ? { left: a.x + geo.R, top: a.y - lane / 2, width: Math.max(8, b.x - a.x - geo.R * 2), height: lane }
          : { left: a.x - lane / 2, top: a.y + geo.R, width: lane, height: Math.max(8, b.y - a.y - geo.R * 2) };
        return (
          <View
            key={`lane-${i}`}
            style={[styles.overlay, box]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Water between the ${from.need} at ${place(from)} and the ${to.need} ${link.horizontal ? 'to its right' : 'below it'}`}
            accessibilityValue={{ text: crossed ? 'no bridge, crossed by another bridge' : count === 0 ? 'no bridge' : count === 1 ? 'one bridge' : 'two bridges' }}
            accessibilityState={{ disabled: solved }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
            onAccessibilityAction={event => {
              if (solved) return;
              if (event.nativeEvent.actionName === 'activate') onTapLane(i, 0.5);
              else if (onAdjustLane) onAdjustLane(i, event.nativeEvent.actionName === 'increment' ? 1 : -1);
            }}
          />
        );
      })}
      {puzzle.islands.map((island, i) => {
        const c = geo.centres[i];
        const has = loads[i];
        return (
          <View
            key={`island-${i}`}
            style={[styles.overlay, { left: c.x - geo.R, top: c.y - geo.R, width: geo.R * 2, height: geo.R * 2 }]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Island ${island.need}, ${place(island)}`}
            accessibilityValue={{ text: has === island.need ? `complete, ${has} bridges` : `${has} of ${island.need} bridges` }}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
});
