import { useEffect } from 'react';
import { getAdjacentById } from '../adjacent';
import { getArukoneById } from '../arukone';
import { getBinairoById } from '../binairo';
import { getBloomById } from '../bloom';
import { getBridgesById } from '../bridges';
import { endlessName, parseEndlessId } from '../endlessId';
import { getGlassWindow } from '../glass';
import { getLevelById } from '../levels';
import { getLightsOutById } from '../lightsout';
import { getLilyById } from '../lilypads';
import { getMirrorMazeById } from '../mirror';
import { getMosaicById } from '../mosaic';
import { getVanesById } from '../vanes';
import { GameKind } from './gameKind';
import { motion } from '../../theme';

/**
 * Builds a puzzle the way opening it does, so the game's own cache holds
 * it. An endless board is generated on first use, and a few generators
 * take long enough (a hard Gravity board or Mirror Maze could take the
 * best part of a second on a phone) that building one as its screen
 * opened froze the entrance.
 */
export function buildPuzzle(kind: GameKind, puzzleId: string): void {
  const endless = parseEndlessId(puzzleId);
  const named = endless?.kind === kind ? { name: endlessName(endless.index, kind), tier: endless.tier } : undefined;
  switch (kind) {
    case 'gravity':
      getLevelById(puzzleId);
      return;
    case 'mirror':
      getMirrorMazeById(puzzleId);
      return;
    case 'lilypads':
      getLilyById(puzzleId, named);
      return;
    case 'vanes':
      getVanesById(puzzleId, named);
      return;
    case 'binairo':
      getBinairoById(puzzleId);
      return;
    case 'arukone':
      getArukoneById(puzzleId);
      return;
    case 'glass':
      getGlassWindow(puzzleId, named);
      return;
    case 'lightsout':
      getLightsOutById(puzzleId);
      return;
    case 'adjacent':
      getAdjacentById(puzzleId);
      return;
    case 'bloom':
      getBloomById(puzzleId);
      return;
    case 'mosaic':
      getMosaicById(puzzleId);
      return;
    case 'bridges':
      getBridgesById(puzzleId);
      return;
  }
}

/** Before the first, and between each - so the hub's own entrance has
 * settled, and a tap never waits behind more than one board. */
const FIRST_MS = motion.beat.prepareOnHome;
const BETWEEN_MS = 450;

/** React Native's idle callbacks, where the runtime has them. */
const idleApi = globalThis as { requestIdleCallback?: (run: () => void) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Builds the puzzles coming up - the rest of the set, today's Daily - one
 * at a time while nothing is moving, so each opens at once. `active` is
 * whether now is a quiet time for it: on Home, or (for the next board
 * alone, `firstMs` later) once a finished set's cards have arrived. Never
 * mid-puzzle, where a board being built would stall the player's moves.
 */
export function usePrepareUpcoming(upcoming: ReadonlyArray<{ kind: GameKind; puzzleId: string }>, active: boolean, firstMs: number = FIRST_MS): void {
  const key = upcoming.map(u => `${u.kind}:${u.puzzleId}`).join(',');
  useEffect(() => {
    if (!active || upcoming.length === 0) return;
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idle: number | null = null;
    const step = (): void => {
      // When the JavaScript thread next has nothing to do - not in the
      // middle of an animation frame's work.
      const run = (): void => {
        idle = null;
        const next = upcoming[index];
        index += 1;
        if (next) buildPuzzle(next.kind, next.puzzleId);
        if (index < upcoming.length) timer = setTimeout(step, BETWEEN_MS);
      };
      if (idleApi.requestIdleCallback) idle = idleApi.requestIdleCallback(run);
      else run();
    };
    timer = setTimeout(step, firstMs);
    return () => {
      if (timer) clearTimeout(timer);
      if (idle !== null) idleApi.cancelIdleCallback?.(idle);
    };
    // The list is read through `key`: a new array with the same puzzles
    // must not start the work again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, firstMs]);
}
