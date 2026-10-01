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
      reason: loads[links[wrong].a] > a.need || loads[links[wrong].b] > puzzle.islands[links[wrong].b].need ? `That ${over.need} has more bridges than its number. This one comes off.` : 'This bridge cuts the harbour the wrong way. It comes off.',
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
    if (lanes.length > 0 && island.need === lanes.length * 2) return `This ${island.need} has ${lanes.length} neighbours, so it needs a double bridge to each.`;
    if (left > room) return `This ${island.need} can't reach its number without a bridge here. Its other lanes hold only ${room}.`;
    return null;
  };
  const reason = reasonFor(links[l].a) ?? reasonFor(links[l].b);
  return {
    state: setBridges(state, l, next),
    link: l,
    kind: reason ? 'rule' : 'nudge',
    reason: reason ?? 'Every island must join one harbour. This bridge is the link that keeps that possible.',
  };
}
