import { HintReason } from '../hints';
import { bridgeLinks, islandLoads, linksByIsland, setBridges } from './logic';
import { deduceBridges } from './solver';
import { BridgesPuzzle, BridgesState } from './types';

/**
 * A hint that reads the harbour as it is. A bridge too many comes off
 * first; otherwise the lane the numbers already force, starting from the
 * island the player is busiest around, with the count that forces it.
 */
export function explainBridgesHint(puzzle: BridgesPuzzle, state: BridgesState): ({ state: BridgesState; link: number } & HintReason) | null {
  const links = bridgeLinks(puzzle);
  const byIsland = linksByIsland(puzzle);
  const loads = islandLoads(puzzle, state);

  const wrong = state.bridges.findIndex((n, l) => n > puzzle.solution[l]);
  if (wrong !== -1) {
    const a = puzzle.islands[links[wrong].a];
    const over = loads[links[wrong].a] > a.need ? a : puzzle.islands[links[wrong].b];
    return {
      state: setBridges(state, wrong, puzzle.solution[wrong]),
      link: wrong,
      kind: 'fix',
      reason:
        loads[links[wrong].a] > a.need || loads[links[wrong].b] > puzzle.islands[links[wrong].b].need
          ? `That ${over.need} island has more bridges than its number allows. This bridge comes off.`
          : 'This bridge leads the harbour the wrong way: with it, the islands can no longer all join up. It comes off.',
      tip: "An island's number is exactly how many bridges touch it. Count both ends of every bridge.",
    };
  }
  const missing = state.bridges.map((n, l) => ({ l, gap: puzzle.solution[l] - n })).filter(({ gap }) => gap > 0);
  if (missing.length === 0) return null;
  const known = deduceBridges(puzzle, true);
  const busy = (l: number) => loads[links[l].a] + loads[links[l].b];
  const forced = missing.filter(({ l }) => !known.broken && known.lo[l] > state.bridges[l]).sort((x, y) => busy(y.l) - busy(x.l));
  const choice = forced[0] ?? missing.sort((x, y) => busy(y.l) - busy(x.l))[0];
  const l = choice.l;
  const next = Math.min(puzzle.solution[l], state.bridges[l] + 1);
  // Say why, from the island with the least room to spare.
  const reasonFor = (i: number): string | null => {
    const island = puzzle.islands[i];
    const lanes = byIsland[i].filter(k => !links[k].crosses.some(j => state.bridges[j] > 0));
    const room = lanes.reduce((sum, k) => sum + (k === l ? 0 : Math.min(2, known.hi[k] ?? 2)), 0);
    const left = island.need - loads[i];
    if (lanes.length > 0 && island.need === lanes.length * 2) return `This ${island.need} has only ${lanes.length} neighbour${lanes.length === 1 ? '' : 's'} it can reach, and a lane holds at most two bridges, so it needs a double bridge to each.`;
    if (left > room) return `This ${island.need} still needs ${left} more, but its other lanes can hold only ${room}. It cannot reach its number without a bridge here.`;
    return null;
  };
  const reason = reasonFor(links[l].a) ?? reasonFor(links[l].b);
  return {
    state: setBridges(state, l, next),
    link: l,
    kind: reason ? 'rule' : 'nudge',
    reason: reason ?? 'Every island must join one harbour in the end. This bridge is the link that keeps that possible.',
    tip: reason
      ? 'Start with islands whose number equals twice their neighbours: each lane is a double. Then islands with only one neighbour.'
      : 'Avoid closing a group of islands off from the rest: everything must end up joined.',
  };
}
