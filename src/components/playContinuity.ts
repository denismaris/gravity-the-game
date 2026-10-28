import { GameKind } from '../game/journey';

/**
 * Board to board without a scene change. When "Next puzzle" moves from one
 * board straight to another, the screen does not transition: the header
 * and the keys are already where they will be, so they simply stay, and
 * only the new board rises in and deals. A different game swaps its emblem
 * and name in place.
 *
 * Set by `App` as it renders the next board; read by the header, the
 * stage entrance and the screen transition as they mount in that same
 * commit. It lapses on its own, so a later visit plays its entrance.
 */
let until = 0;
let fromKind: GameKind | null = null;

export function markContinuing(from: GameKind): void {
  until = Date.now() + 800;
  fromKind = from;
}

/** Whether the screen now mounting continues straight on from a board. */
export function isContinuing(): boolean {
  return Date.now() < until;
}

/** The game the last board was, while continuing; null otherwise. */
export function continuingFrom(): GameKind | null {
  return isContinuing() ? fromKind : null;
}

/**
 * A repaint, not an arrival: switching light and dark (or larger text)
 * rebuilds the screen on show so every colour is read afresh. It is the
 * same page, so nothing on it makes an entrance - no slide, no rise, no
 * deal, no flowers growing in. Set by `App` as it rebuilds; lapses alone.
 */
let repaintUntil = 0;

export function markRepaint(): void {
  repaintUntil = Date.now() + 800;
}

export function isRepainting(): boolean {
  return Date.now() < repaintUntil;
}
