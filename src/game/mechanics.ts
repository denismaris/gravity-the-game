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
    id: 'mechanic:lantern-twins',
    game: 'lightsout',
    title: 'Twin lanterns',
    body: 'Two lanterns tied by a golden thread are twins: pressing one also switches the other, wherever it is on the board.',
    sample: 'lightsout-medium-t01',
  },
  {
    id: 'mechanic:glass-vines',
    game: 'glass',
    title: 'Vines',
    body: 'Two leaf panes joined by a green stem: exactly one of them is emerald, and no other pane ever is. Work out which.',
    sample: 'glass-medium-g01',
  },
  {
    id: 'mechanic:adjacent-stone',
    game: 'adjacent',
    title: 'Stones',
    body: 'A grey stone joins no run. Clear everything beneath it and it lands on the floor and crumbles, for 200 points.',
    sample: 'adjacent-medium-s01',
  },
  {
    id: 'mechanic:adjacent-gold',
    game: 'adjacent',
    title: 'Gold tiles',
    body: 'A gold tile joins a run of any colour it touches, and a run with gold in it scores double. Save it for a big one.',
    sample: 'adjacent-hard-g01',
  },
  {
    id: 'mechanic:lily-stones',
    game: 'lilypads',
    title: 'Stepping stones',
    body: 'The frog can land on a stone and leave it as often as it likes. A stone never sinks and is not a pad to clear, but it stops a hop like a pad does.',
    sample: 'lily-medium-s01',
  },
  {
    id: 'mechanic:sand',
    game: 'gravity',
    title: 'Soft sand',
    body: 'A ball that rolls onto sand sinks in and stops right there. On the next tilt it rolls off again as usual.',
    sample: 'level-231',
  },
  {
    id: 'mechanic:bridges-fog',
    game: 'bridges',
    title: 'Islands in fog',
    body: 'An island in fog shows no number. Work out how many bridges it takes from the islands round it: whatever they still need from it.',
    sample: 'bridges-medium-m01',
  },
  {
    id: 'mechanic:mirror-ruby',
    game: 'mirror',
    title: 'Ruby light',
    body: 'Gems with a red ring are ruby gems, and they only light for a red beam. Send the beam through the square of red glass first: from there on it shines red, and lights the ruby gems it reaches. Ordinary gems light for any beam.',
    sample: 'mirror-r01',
  },
  {
    id: 'mechanic:mirror-splitter',
    game: 'mirror',
    title: 'Splitters',
    body: 'A cut crystal splits the beam in two, out to either side. Either half can light gems, and one half must reach the target.',
    sample: 'mirror-s01',
  },
  {
    id: 'mechanic:bloom-twins',
    game: 'bloom',
    title: 'Twin tiles',
    body: 'Two tiles with matching rings are twins. Turn one and the other turns with it, the same way.',
    sample: 'bloom-medium-t01',
  },
];

export function mechanic(id: string): Mechanic {
  const found = MECHANICS.find(m => m.id === id);
  if (!found) throw new Error(`Unknown mechanic ${id}`);
  return found;
}
