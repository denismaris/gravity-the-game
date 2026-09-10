import { applyGravity } from './gravity';
import { Direction, GameState } from './types';

/**
 * A `GameSession` tracks a puzzle's full history of states so the UI can
 * support Undo (step back exactly one state) and Restart (return to the
 * original level layout) without containing any game logic itself.
 *
 * `history` is a stack of states; the last entry is always the state
 * currently shown to the player. `initial` never changes for the lifetime
 * of a session and is what Restart returns to.
 */
export interface GameSession {
  readonly initial: GameState;
  readonly history: ReadonlyArray<GameState>;
}

/** Starts a fresh session at `initial`, with nothing to undo yet. */
export function createGameSession(initial: GameState): GameSession {
  return { initial, history: [initial] };
}

/** The state the player is currently looking at / interacting with. */
export function getCurrentState(session: GameSession): GameState {
  return session.history[session.history.length - 1];
}

/** Whether there is a previous state to undo to. */
export function canUndo(session: GameSession): boolean {
  return session.history.length > 1;
}

export type GameAction =
  | { type: 'gravity'; direction: Direction }
  | { type: 'undo' }
  | { type: 'restart' };

function movablesEqual(a: GameState, b: GameState): boolean {
  if (a.movables.length !== b.movables.length) return false;

  for (let i = 0; i < a.movables.length; i += 1) {
    if (a.movables[i].row !== b.movables[i].row || a.movables[i].col !== b.movables[i].col) {
      return false;
    }
  }

  return true;
}

/**
 * Pure reducer driving a puzzle session. This is the single place that
 * knows how to apply gravity, undo, and restart - the UI only ever
 * dispatches actions and reads `getCurrentState(session)`.
 *
 * - `gravity`: applies gravity via the engine and pushes the result onto
 *   history. A gravity call that doesn't move anything (a no-op) does NOT
 *   create a new undo step, so Undo always takes the player to a visibly
 *   different state.
 * - `undo`: pops the most recent state, restoring the previous one. A
 *   no-op if there is nothing to undo.
 * - `restart`: clears history back down to the original level state.
 */
export function gameSessionReducer(session: GameSession, action: GameAction): GameSession {
  switch (action.type) {
    case 'gravity': {
      const current = getCurrentState(session);
      const next = applyGravity(current, action.direction);

      if (movablesEqual(current, next)) return session;

      return { ...session, history: [...session.history, next] };
    }

    case 'undo': {
      if (!canUndo(session)) return session;
      return { ...session, history: session.history.slice(0, -1) };
    }

    case 'restart': {
      if (session.history.length === 1 && session.history[0] === session.initial) {
        return session;
      }
      return { ...session, history: [session.initial] };
    }

    default:
      return session;
  }
}
