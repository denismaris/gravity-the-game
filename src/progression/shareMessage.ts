export interface ShareMessageInput {
  readonly dailyStreak: number;
  readonly totalStars: number;
  readonly solved: number;
  readonly totalPuzzles: number;
}

/**
 * The Home stats card's "Share" button text - a Wordle-style brag, not a
 * progress report: leads with the streak when there is one (the number
 * worth showing off), falls back to the solved count when there isn't one
 * yet, so a brand-new player's first share still reads as something
 * rather than "0-day streak". Pure and exported on its own so its exact
 * wording is a tested contract, not something only visible by opening the
 * share sheet by hand.
 *
 * No link included - the app has no public App Store page yet; adding a
 * placeholder URL here would be worse than no URL at all.
 */
export function buildShareMessage({ dailyStreak, totalStars, solved, totalPuzzles }: ShareMessageInput): string {
  const headline =
    dailyStreak > 0
      ? `🔥 ${dailyStreak}-day streak on Tessera. ★${totalStars}, ${solved}/${totalPuzzles} solved.`
      : `★${totalStars} · ${solved}/${totalPuzzles} puzzles solved on Tessera.`;
  return `${headline}\nTwelve calm puzzle games, one app.`;
}
