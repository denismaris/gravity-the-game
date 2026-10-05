import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { GameState } from '../game/engine';
import { BoardView, useReducedMotion, useSlidePlan } from '../game/rendering';

export interface GravityBoardProps {
  /** The engine's authoritative state - changes once per move, never
   * per frame. */
  state: GameState;
  /** Skip the slide and snap (undo, restart, first mount). */
  instant: boolean;
  size: number;
  onTargetIds: ReadonlySet<string>;
  /** Every object is home - runs the board's own finish flare. */
  solved?: boolean;
  /** Called when a slide finishes. The screen sets its own flag to `true`
   * synchronously when it dispatches a move, so this only ever has to
   * report the falling edge - see the note below on why the rising edge
   * cannot come from here. */
  onAnimatingChange: (animating: boolean) => void;
}

/**
 * Gravity's board, with the slide animation sealed inside it.
 *
 * The slide itself runs on the UI thread: `useSlidePlan` hands each
 * piece where it starts and how long it has, and the pieces animate
 * themselves (see `SlidingPiece`). A move costs React two renders, its
 * start and its settle. It used to set state on every frame of the slide,
 * which first re-rendered the whole screen and, once moved down here, still
 * re-rendered this board sixty times a second on the JS thread.
 *
 * The screen still needs to know when a slide is in flight, but it must
 * learn that *synchronously* at dispatch, not from this component: a move
 * commits, `solved` flips, and the win haptic and the solved card would
 * both fire before the winning piece has visibly moved. So the screen sets
 * its own flag when it dispatches, and this reports only the settle.
 */
export const GravityBoard = React.memo(function GravityBoardImpl({
  state,
  instant,
  size,
  onTargetIds,
  solved = false,
  onAnimatingChange,
}: GravityBoardProps): React.JSX.Element {
  // Reduced motion reuses the exact same "skip the tween" path `instant`
  // already provides for undo/restart - pieces still move to the right
  // cell (that's real game state, not decoration), they just get there in
  // one frame instead of an animated slide.
  const reducedMotion = useReducedMotion();
  const slide = useSlidePlan(state.movables, instant || reducedMotion);

  useEffect(() => {
    onAnimatingChange(slide.isAnimating);
  }, [slide.isAnimating, onAnimatingChange]);

  return (
    <Canvas style={styles.canvas}>
      <BoardView
        state={state}
        slide={slide}
        size={size}
        onTargetIds={onTargetIds}
        solved={solved}
      />
    </Canvas>
  );
});

// Matches the style the canvas had when it lived in `GameScreen`, so
// moving it here changes nothing about layout.
const styles = StyleSheet.create({ canvas: { flex: 1 } });
