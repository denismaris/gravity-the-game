import { ROTATION } from '../journey';
import { LevelDefinition } from '../levels';
import {
  copyForTutorial,
  mechanicsOf,
  MechanicTutorialId,
  pickTutorial,
  TutorialId,
  tutorialIdForGame,
  tutorialIdForMechanic,
} from '../tutorials';

const ALL_GAME_KINDS = ROTATION;
const ALL_MECHANIC_IDS: MechanicTutorialId[] = ['obstacles', 'anchored', 'portals', 'gravity-zone', 'hazard'];

function baseLevel(overrides: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'level-test',
    order: 1,
    name: 'Test',
    rows: 4,
    cols: 4,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 3, col: 3 }],
    obstacles: [],
    difficulty: 'easy',
    ...overrides,
  };
}

describe('tutorial ids', () => {
  test('tutorialIdForGame / tutorialIdForMechanic produce the documented shape', () => {
    expect(tutorialIdForGame('sudoku')).toBe('game:sudoku');
    expect(tutorialIdForMechanic('hazard')).toBe('mechanic:hazard');
  });

  test('every game and mechanic id has real, non-empty copy', () => {
    const allIds: TutorialId[] = [
      ...ALL_GAME_KINDS.map(tutorialIdForGame),
      ...ALL_MECHANIC_IDS.map(tutorialIdForMechanic),
    ];
    for (const id of allIds) {
      const copy = copyForTutorial(id);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });
});

describe('mechanicsOf', () => {
  test('a plain level (no mechanics) reports none', () => {
    expect(mechanicsOf(baseLevel({}))).toEqual([]);
  });

  test('detects each mechanic independently', () => {
    expect(mechanicsOf(baseLevel({ obstacles: [{ row: 1, col: 1 }] }))).toEqual(['obstacles']);
    expect(mechanicsOf(baseLevel({ anchors: [{ row: 1, col: 1 }] }))).toEqual(['anchored']);
    expect(mechanicsOf(baseLevel({ portals: [[{ row: 0, col: 1 }, { row: 3, col: 2 }]] }))).toEqual(['portals']);
    expect(
      mechanicsOf(baseLevel({ zone: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1, direction: 'down' } })),
    ).toEqual(['gravity-zone']);
    expect(mechanicsOf(baseLevel({ hazards: [{ row: 1, col: 1 }] }))).toEqual(['hazard']);
  });

  test('an empty (but present) array field does not count as using the mechanic', () => {
    expect(mechanicsOf(baseLevel({ anchors: [], portals: [], hazards: [] }))).toEqual([]);
  });

  test('multiple mechanics report in the fixed teaching order, not authoring order', () => {
    const level = baseLevel({
      hazards: [{ row: 3, col: 0 }],
      obstacles: [{ row: 1, col: 1 }],
      zone: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1, direction: 'down' },
    });
    expect(mechanicsOf(level)).toEqual(['obstacles', 'gravity-zone', 'hazard']);
  });
});

describe('pickTutorial', () => {
  const candidates: TutorialId[] = ['game:gravity', 'mechanic:obstacles', 'mechanic:hazard'];

  test('returns the first unseen candidate', () => {
    expect(pickTutorial([], candidates)).toBe('game:gravity');
    expect(pickTutorial(['game:gravity'], candidates)).toBe('mechanic:obstacles');
  });

  test('returns null once every candidate has been seen', () => {
    expect(pickTutorial(candidates, candidates)).toBeNull();
  });

  test('seen ids outside the candidate list are irrelevant', () => {
    expect(pickTutorial(['mechanic:portals'], candidates)).toBe('game:gravity');
  });
});
