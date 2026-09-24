import {
  EncouragementTier,
  encouragementsFor,
  encouragementTier,
  pickEncouragement,
} from '../encouragement';

const TIERS: ReadonlyArray<EncouragementTier> = ['flawless', 'strong', 'solid'];

describe('encouragementTier', () => {
  test('flawless needs both full stars and no hints', () => {
    expect(encouragementTier(3, 0)).toBe('flawless');
  });

  test('either full stars or a hint-free run alone is only strong', () => {
    expect(encouragementTier(3, 2)).toBe('strong');
    expect(encouragementTier(1, 0)).toBe('strong');
    expect(encouragementTier(2, 0)).toBe('strong');
  });

  test('neither one is solid - still finished, still encouraged', () => {
    expect(encouragementTier(1, 3)).toBe('solid');
    expect(encouragementTier(2, 1)).toBe('solid');
  });
});

describe('encouragement pools', () => {
  test.each(TIERS)('%s has several distinct lines to draw from', tier => {
    const pool = encouragementsFor(tier);
    expect(pool.length).toBeGreaterThanOrEqual(4);
    expect(new Set(pool).size).toBe(pool.length);
  });

  test('no line is shared between tiers - praise for a scraped win must not read as praise for a perfect one', () => {
    const all = TIERS.flatMap(tier => [...encouragementsFor(tier)]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('pickEncouragement', () => {
  test('always returns a line from the requested tier', () => {
    for (const tier of TIERS) {
      for (let i = 0; i < 20; i += 1) {
        expect(encouragementsFor(tier)).toContain(pickEncouragement(tier));
      }
    }
  });

  test('never repeats the previous line', () => {
    for (const tier of TIERS) {
      const pool = encouragementsFor(tier);
      for (const previous of pool) {
        // Sweep the whole random range - every draw has to avoid `previous`,
        // not merely most of them.
        for (let step = 0; step < 20; step += 1) {
          const line = pickEncouragement(tier, previous, () => step / 20);
          expect(line).not.toBe(previous);
        }
      }
    }
  });

  test('a previous line from another tier simply does not apply', () => {
    const line = pickEncouragement('solid', encouragementsFor('flawless')[0], () => 0);
    expect(line).toBe(encouragementsFor('solid')[0]);
  });

  test('a random of exactly 1 stays in range rather than falling off the end', () => {
    for (const tier of TIERS) {
      expect(encouragementsFor(tier)).toContain(pickEncouragement(tier, undefined, () => 1));
    }
  });

  test('successive picks vary rather than settling on one line', () => {
    let previous: string | undefined;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      previous = pickEncouragement('solid', previous);
      seen.add(previous);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
