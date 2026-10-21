import type { GameKind } from './journey';

/**
 * Every rule a game adds partway in, in one place: what the one-time card
 * says when it first appears, and a board to try it on from the Mechanics
 * lab (see `MechanicsLabScreen`). Each game's screen passes the ones its
 * board brings to `MechanicIntro`.
 */
export interface Mechanic {
  readonly id: string;
  readonly game: GameKind;
  readonly title: string;
  readonly body: string;
  /** A board that has it, to open from the lab. */
  readonly sample: string;
}

export const MECHANICS: ReadonlyArray<Mechanic> = [
  {
    id: 'mechanic:glass-vines',
    game: 'glass',
    title: 'Vines',
    body: 'A vine joins two leaf pieces. One of them is green and the other is not. No other piece is ever green. Can you tell which one?',
    sample: 'glass-medium-g01',
  },
  {
    id: 'mechanic:adjacent-stone',
    game: 'adjacent',
    title: 'Stones',
    body: 'Grey stones never join a group. Clear the tiles under a stone and it falls and breaks, for 200 points.',
    sample: 'adjacent-medium-s01',
  },
  {
    id: 'mechanic:adjacent-gold',
    game: 'adjacent',
    title: 'Gold tiles',
    body: 'A gold tile joins any colour group it touches, and that group scores double. Save it for a big group.',
    sample: 'adjacent-hard-g01',
  },
  {
    id: 'mechanic:lily-stones',
    game: 'lilypads',
    title: 'Stepping stones',
    body: 'The frog can land on a stone as often as it likes. Stones never sink, and you do not have to visit them. A stone stops a jump, just like a pad.',
    sample: 'lily-medium-s01',
  },
  {
    id: 'mechanic:sand',
    game: 'gravity',
    title: 'Soft sand',
    body: 'A ball that rolls onto sand stops there. Swipe again and it rolls on.',
    sample: 'level-231',
  },
  {
    id: 'mechanic:bridges-fog',
    game: 'bridges',
    title: 'Islands in fog',
    body: 'An island in fog hides its number. Work it out from the islands around it: it is whatever they still need.',
    sample: 'bridges-medium-m01',
  },
  {
    id: 'mechanic:mirror-ruby',
    game: 'mirror',
    title: 'Ruby light',
    body: 'Gems with a red ring only light up with red light. Send the light through the red glass square first. After that it shines red and can light the red gems. Normal gems light up with any light.',
    sample: 'mirror-r01',
  },
  {
    id: 'mechanic:mirror-splitter',
    game: 'mirror',
    title: 'Splitters',
    body: 'A crystal splits the light in two. Both parts can light gems. One part must reach the gold ring.',
    sample: 'mirror-s01',
  },
  {
    id: 'mechanic:bloom-twins',
    game: 'bloom',
    title: 'Twin tiles',
    body: 'Two tiles with matching rings are twins. When you turn one, the other turns too.',
    sample: 'bloom-medium-t01',
  },
];

export function mechanic(id: string): Mechanic {
  const found = MECHANICS.find(m => m.id === id);
  if (!found) throw new Error(`Unknown mechanic ${id}`);
  return found;
}
