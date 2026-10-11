/** The Villas follow the year: blossom in spring, warm leaves in autumn,
 * frost and snow in winter (see `VillaIsland`, `VillaSky`). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** The season of `date`, by the northern calendar. */
export function seasonOf(date: Date): Season {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}
