import { useEffect, useRef, useState } from 'react';

/**
 * One beat, shared by every game, between a board being solved and its
 * completion card arriving.
 *
 * Every board here plays something when it is finished - a wave of
 * lights going out, a beam igniting, tiles sweeping off a tray - and
 * every screen was mounting `PuzzleSolved` the instant `solved` flipped,
 * which drops a dimmed scrim and a card straight over the top of it. The
 * celebrations were all still running, underneath, unseen. Work that was
 * done and then hidden.
 *
 * Deliberately **one constant rather than a duration per game**. The
 * alternative - ask each board how long its own finish animation takes
 * and wait exactly that - sounds more precise and is worse twice over:
 * the waits would differ by nearly two seconds between games (Lights
 * Out's staggered wave against Fill-a-Pix's single pulse), so finishing
 * a puzzle would feel arbitrarily slow or fast depending on which one
 * the batch dealt; and every board's timing constants would become load-
 * bearing for a screen that has no other reason to know them. Instead
 * the beat is fixed, and each board's finish animation is tuned to land
 * inside it - which is also what makes the whole app feel like one app
 * at the moment it matters most.
 *
 * ~620ms is long enough for a staggered wave to read as a wave and short
 * enough that nobody waits on it.
 */
export const SOLVE_CELEBRATION_MS = 620;

/**
 * `true` once `solved` has been set for a full celebration beat.
 *
 * Flips back to `false` immediately when `solved` goes false again (a
 * restart), so a replayed board does not keep a stale card on screen.
 */
export function useSolveCelebration(solved: boolean, delayMs: number = SOLVE_CELEBRATION_MS): boolean {
  const [elapsed, setElapsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!solved) {
      setElapsed(false);
      return;
    }
    timerRef.current = setTimeout(() => setElapsed(true), delayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [solved, delayMs]);

  return solved && elapsed;
}
