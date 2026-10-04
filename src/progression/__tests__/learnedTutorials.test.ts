import { emptyProgress, recordCompletion } from '../playerProgress';
import { learnedTutorials } from '../learnedTutorials';
import { BINAIRO } from '../../game/binairo';
import { LEVELS } from '../../game/levels';
import { mechanicsOf, tutorialIdForMechanic } from '../../game/tutorials';

describe('guides a player has already learned', () => {
  test('none for a new player', () => {
    expect(learnedTutorials(emptyProgress())).toEqual([]);
  });

  test('every game with a solved puzzle, and the Gravity mechanics of solved levels', () => {
    const withMechanic = LEVELS.find(level => mechanicsOf(level).length > 0)!;
    let progress = recordCompletion(emptyProgress(), BINAIRO[0].id, 3, { two: 4, three: 2 });
    progress = recordCompletion(progress, withMechanic.id, 3, { two: 4, three: 2 });
    const learned = learnedTutorials(progress);
    expect(learned).toContain('game:binairo');
    expect(learned).toContain('game:gravity');
    for (const mechanic of mechanicsOf(withMechanic)) expect(learned).toContain(tutorialIdForMechanic(mechanic));
    expect(learned).not.toContain('game:mosaic');
  });
});
