import React, { useCallback } from 'react';
import { announce } from '../game/rendering';

/**
 * Why Insight made the move it made. It used to be said in a card that
 * popped up above the keys; the player found the pop-ups in the way, so
 * the move now speaks for itself on the board. With a screen reader on the
 * reason is still read aloud, since there the move cannot be seen.
 *
 * Kept as a hook with the same shape, so every game's hint can go on
 * handing it its reason.
 */
export function useHintNote(): { note: React.JSX.Element | null; show: (hint: { reason?: string; tip?: string } | null | undefined) => void; hide: () => void } {
  const show = useCallback((hint: { reason?: string; tip?: string } | null | undefined) => {
    if (!hint?.reason) return;
    announce(hint.tip ? `${hint.reason} ${hint.tip}` : hint.reason, 300);
  }, []);
  const hide = useCallback(() => {}, []);
  return { note: null, show, hide };
}
