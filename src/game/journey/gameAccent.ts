import { theme } from '../../theme';
import { GameKind } from './gameKind';

/**
 * One accent colour per game, so each reads as a distinct thing at a
 * glance (Home's hero card, each screen's kicker line, Browse's section
 * headers, a game-intro tutorial's eyebrow) without duplicating this
 * mapping in every place that needs it. Gravity's is `theme.colors.
 * secondary` - already established everywhere as the app's one loud colour,
 * not a new one introduced here.
 */
/**
 * Each game's own name, in the upper-case form its screen header already
 * uses ("SKYSCRAPERS", not "towers"). Lives beside `accentColorForKind`
 * for the same reason: it is game identity, and it was previously
 * hardcoded separately in all five screen headers, so anything else
 * wanting to name a game had nowhere to ask.
 */
export function gameLabelForKind(kind: GameKind): string {
  switch (kind) {
    case 'gravity':
      return 'GRAVITY';
    case 'mirror':
      return 'MIRROR MAZE';
    case 'tents':
      return 'TENTS AND TREES';
    case 'towers':
      return 'SKYSCRAPERS';
    case 'binairo':
      return 'BINAIRO';
  }
}

export function accentColorForKind(kind: GameKind): string {
  switch (kind) {
    case 'gravity':
      return theme.colors.secondary;
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
