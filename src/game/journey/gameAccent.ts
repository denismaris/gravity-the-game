import { theme } from '../../theme';
import { GameKind } from './playlist';

/**
 * One accent colour per game, so the four read as distinct things at a
 * glance (Home's hero card, each screen's kicker line, Browse's section
 * headers, a game-intro tutorial's eyebrow) without duplicating this
 * mapping in every place that needs it. Gravity's is `theme.colors.
 * secondary` - already established everywhere as the app's one loud colour,
 * not a new one introduced here.
 */
export function accentColorForKind(kind: GameKind): string {
  switch (kind) {
    case 'gravity':
      return theme.colors.secondary;
    case 'constellation':
      return theme.colors.constellationAccent;
    case 'trajectory':
      return theme.colors.trajectoryAccent;
    case 'sudoku':
      return theme.colors.sudokuAccent;
    case 'mirror':
      return theme.colors.mirrorAccent;
    case 'tents':
      return theme.colors.tentsAccent;
    case 'towers':
      return theme.colors.towersAccent;
    case 'binairo':
      return theme.colors.binairoAccent;
  }
}
