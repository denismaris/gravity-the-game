import { hop, hopsFrom, initialLilyState, isLilySolved, solveLily } from '../../../game/lilypads';
import { isVaneSolved, troubles, turn, VaneState } from '../../../game/vanes';
import { POND_PLAN, ROOF } from '../trialLessons';

/** The trial lessons say true things about their boards. */
describe('trial lessons', () => {
  test('Lily Pads: from the middle, left first clears the pond and right first cannot', () => {
    const s = initialLilyState(POND_PLAN);
    expect(hopsFrom(POND_PLAN, s).sort()).toEqual([1, 2]);
    expect(solveLily(POND_PLAN, hop(POND_PLAN, s, 1))).not.toBeNull();
    expect(solveLily(POND_PLAN, hop(POND_PLAN, s, 2))).toBeNull();
  });

  test('Weathervanes: each step leaves the roof as its praise says, and the last sets it', () => {
    let s: VaneState = { dirs: [...ROOF.start] };
    const tap = (v: number, times: number) => {
      for (let k = 0; k < times; k += 1) s = turn(ROOF, s, v);
    };
    tap(0, 1); // up to right: now it and the top right point at each other
    expect(troubles(ROOF, s)[0]).toBe('pair');
    tap(1, 3); // left, up, right, down
    expect(s.dirs[1]).toBe(2);
    expect(troubles(ROOF, s)[1]).toBeNull();
    tap(3, 1); // down to left: the bottom left is reached, but points off the roof
    expect(troubles(ROOF, s)[2]).toBe('air');
    tap(2, 1); // left to up
    expect(isVaneSolved(ROOF, s)).toBe(true);
    expect(isLilySolved(initialLilyState(POND_PLAN))).toBe(false);
  });
});
