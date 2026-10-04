import { puzzleKindOf } from '../game/journey';
import { getLevelById } from '../game/levels';
import { mechanicsOf, tutorialIdForGame, tutorialIdForMechanic } from '../game/tutorials';
import { PlayerProgress } from './playerProgress';

/**
 * The "how to play" guides a player has effectively already been through,
 * judged from what they have played rather than from this phone's memory:
 * a game they have solved a puzzle of, and every Gravity mechanic in a
 * level they have solved.
 *
 * Which guides were shown is kept on the phone (`Settings.seenTutorials`),
 * but progress lives in the account - so after signing back in, on a new
 * phone or after a reinstall, the guides used to open again for games the
 * player knows well. `useLearnedTutorials` marks these as seen whenever the
 * save loads or comes back from the account.
 */
export function learnedTutorials(progress: PlayerProgress): string[] {
  const learned = new Set<string>();
  for (const id of Object.keys(progress.levels)) {
    if (!progress.levels[id]?.completed) continue;
    const kind = puzzleKindOf(id)?.kind;
    if (!kind) continue;
    learned.add(tutorialIdForGame(kind));
    if (kind === 'gravity') {
      const level = getLevelById(id);
      if (level) for (const mechanic of mechanicsOf(level)) learned.add(tutorialIdForMechanic(mechanic));
    }
  }
  return Array.from(learned);
}
