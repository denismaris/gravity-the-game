import { theme } from '../../theme';
import { gameDisplayName, GameKind } from './gameKind';

/**
 * One accent colour per game, so each reads as a distinct thing at a
 * glance (Home's hero card, each screen's kicker line, Browse's section
 * headers, a game-intro tutorial's eyebrow) without duplicating this
 * mapping in every place that needs it. Gravity's is `theme.colors.
 * secondary` - already established everywhere as the app's one loud colour,
 * not a new one introduced here.
 */
/**
 * Each game's own name, in the upper-case form its screen header uses
 * ("SKYSCRAPERS", not "towers"). Derived from `gameDisplayName` rather
 * than spelled out again: this used to be its own eight-case switch, and
 * once the aptitude chart needed the title-case form too, the app had two
 * hand-maintained lists of the same eight names.
 */
export function gameLabelForKind(kind: GameKind): string {
  return gameDisplayName(kind).toUpperCase();
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
    case 'arukone':
      return theme.colors.arukoneAccent;
    case 'fillapix':
      return theme.colors.fillapixAccent;
    case 'lightsout':
      return theme.colors.lightsOutAccent;
    case 'adjacent':
      return theme.colors.adjacentAccent;
    case 'bloom':
      return theme.colors.bloomAccent;
    case 'mosaic':
      return theme.colors.mosaicAccent;
    case 'bridges':
      return theme.colors.bridgesAccent;
  }
}
