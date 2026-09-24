import { useRef } from 'react';

/**
 * The board intro wave, shared by every Skia board.
 *
 * A board appearing all at once reads as a screenshot; the same board
 * arriving corner-to-corner reads as something being dealt out. Binairo
 * had this and the other boards did not, which is most of why its board
 * felt more finished than its siblings despite drawing similar shapes.
 *
 * The wave expands as squares from the top-left corner: a cell's delay is
 * `max(row, col)`, its Chebyshev distance from the origin, so whole L-
 * shaped rings light up at once rather than the board marching row by row.
 * Taken from Binairo's own implementation, which this now backs - not a
 * new wave shape invented alongside it.
 */

/** Delay added per step of diagonal distance from the origin corner. */
export const INTRO_STAGGER_MS = 34;
/** How long one cell takes to settle once its turn arrives. */
export const INTRO_TILE_MS = 340;
/**
 * Total window the wave is considered active, after which callers can stop
 * driving the animation clock. Sized against the largest board in the app:
 * at 10x10 the far corner is 9 rings out, so `9 * 34 + 340 = 646`, inside
 * this budget. A board bigger than 10x10 must raise this rather than
 * assume it still fits - the last cells would otherwise be cut off
 * mid-arrival.
 */
export const INTRO_TOTAL_MS = 700;

/**
 * When the current wave started - `now` at first mount, and again each
 * time `introKey` changes (a restart).
 *
 * Held in a ref rather than state on purpose: nothing here needs a render
 * of its own, because the animation clock already drives one for the whole
 * window this covers. Reading `now` as an argument (rather than calling
 * `Date.now()` inside) keeps every cell in a frame on one timestamp.
 */
export function useIntroWave(introKey: number | undefined, now: number): number {
  const startedAtRef = useRef(now);
  const prevKeyRef = useRef(introKey);
  if (introKey !== prevKeyRef.current) {
    startedAtRef.current = now;
    prevKeyRef.current = introKey;
  }
  return startedAtRef.current;
}

/**
 * How far one cell is through its own arrival: 0 before its turn comes, 1
 * once it has settled. `elapsed` is time since the wave began (see
 * `useIntroWave`).
 */
export function introCellProgress(elapsed: number, row: number, col: number): number {
  const cellElapsed = elapsed - Math.max(row, col) * INTRO_STAGGER_MS;
  if (cellElapsed <= 0) return 0;
  if (cellElapsed >= INTRO_TILE_MS) return 1;
  return cellElapsed / INTRO_TILE_MS;
}

/** Whether the wave is still running and the clock still needs driving. */
export function isIntroActive(elapsed: number, reducedMotion: boolean): boolean {
  return !reducedMotion && elapsed < INTRO_TOTAL_MS;
}
