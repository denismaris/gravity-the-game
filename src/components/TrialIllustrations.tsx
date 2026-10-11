import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { cutOff, hopsFrom, LilyState } from '../game/lilypads';
import { Dir } from '../game/vanes';
import { LilyStill } from './LilyPadsBoard';
import { POND_PLAN, ROOF } from './lessons/trialLessons';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { vaneGeometry, VanesRoof } from './VanesBoard';

/**
 * The help pictures for the two games on trial, drawn by the boards
 * themselves on the lessons' small ponds and roofs, so the help shows
 * exactly what the game looks like.
 */
const SIZE = ILLUSTRATION_HEIGHT - 6;

function Centred({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - SIZE) / 2 }, { translateY: (ILLUSTRATION_HEIGHT - SIZE) / 2 }]}>{children}</Group>;
}

const pond = (at: number, afloat: boolean[]): LilyState => ({ at, afloat });

export function renderLilyIllustration(kind: string): React.JSX.Element {
  const start = pond(0, [true, true, true, true]);
  switch (kind) {
    case 'sink':
      return (
        <Centred>
          <LilyStill puzzle={POND_PLAN} state={pond(1, [false, true, true, true])} size={SIZE} sunk={[0]} />
        </Centred>
      );
    case 'lotus':
      return (
        <Centred>
          <LilyStill puzzle={POND_PLAN} state={{ at: 0, afloat: [true, true, true, true], lotus: [false, false, true, false] }} size={SIZE} reach={hopsFrom(POND_PLAN, start)} />
        </Centred>
      );
    case 'cutoff': {
      const s = pond(3, [false, true, false, true]);
      return (
        <Centred>
          <LilyStill puzzle={POND_PLAN} state={s} size={SIZE} cutOff={cutOff(POND_PLAN, s)} />
        </Centred>
      );
    }
    case 'clear':
      return (
        <Centred>
          <LilyStill puzzle={POND_PLAN} state={pond(3, [false, false, false, true])} size={SIZE} bloom />
        </Centred>
      );
    default:
      return (
        <Centred>
          <LilyStill puzzle={POND_PLAN} state={start} size={SIZE} reach={hopsFrom(POND_PLAN, start)} />
        </Centred>
      );
  }
}

const ROOF_GEO = vaneGeometry(SIZE, ROOF.size);
const roof = (dirs: Dir[], glow?: number) => (
  <Centred>
    <VanesRoof puzzle={ROOF} state={{ dirs }} geo={ROOF_GEO} solved={false} glow={glow} />
  </Centred>
);

export function renderVanesIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'wind':
      return roof([1, 2, 0, 2]);
    case 'trouble':
      return roof([1, 3, 3, 1]);
    case 'loop':
      return roof([...ROOF.solution]);
    case 'chimney':
      return (
        <Centred>
          <VanesRoof puzzle={{ ...ROOF, chimneys: [{ row: 1, col: 2 }] }} state={{ dirs: [1, 2, 0, 3] }} geo={ROOF_GEO} solved={false} />
        </Centred>
      );
    default:
      return roof([...ROOF.start], 0);
  }
}
