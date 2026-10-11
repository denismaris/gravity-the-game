import React from 'react';
import { GameKind } from '../../game/journey';
import { LESSON_GUIDES, LessonGuideContext } from './guides';
import { BloomLesson, LanternsLesson, MirrorLesson, TwosLesson } from './gridLessons';
import { LilyPadsLesson, VanesLesson } from './trialLessons';
import { GlassLesson } from './glassLesson';
import { AdjacentLesson, BridgesLesson, GravityLesson, MosaicLesson, TwinpathLesson } from './moreLessons';

/** The hands-on lesson for each game that has one: the first time a
 * player opens the game, they play it - a tiny board, a step at a time -
 * instead of reading about it. */
export const LESSONS: Record<GameKind, React.ComponentType<{ onDone: () => void }>> = {
  binairo: TwosLesson,
  lilypads: LilyPadsLesson,
  lightsout: LanternsLesson,
  glass: GlassLesson,
  mirror: MirrorLesson,
  bloom: BloomLesson,
  vanes: VanesLesson,
  adjacent: AdjacentLesson,
  bridges: BridgesLesson,
  arukone: TwinpathLesson,
  mosaic: MosaicLesson,
  gravity: GravityLesson,
};

/**
 * The first time a player opens a game, this plays instead of the puzzle
 * (see `AppRoutes`): its own route, so the game screen mounts fresh, with
 * its entrance, once the lesson is done.
 */
export function GameLesson({ kind, onDone }: { kind: GameKind; onDone: () => void }): React.JSX.Element {
  const Lesson = LESSONS[kind];
  return (
    <LessonGuideContext.Provider value={LESSON_GUIDES[kind]}>
      <Lesson onDone={onDone} />
    </LessonGuideContext.Provider>
  );
}
