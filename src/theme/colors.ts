/**
 * Core color palette for the Gravity design system.
 *
 * Direction: a warm printed-almanac feel - cream paper, ink text, one loud
 * accent, ochre for stars - now tuned to lean into Claude's own warm-coral-
 * on-cream identity rather than away from it: `secondary` moved from a
 * brick-leaning terracotta toward Claude's own warmer, more orange coral,
 * since the two visual languages (warm paper ground, one confident warm
 * accent) were already the same idea. Light, calm, airy. Hierarchy comes
 * from a real paper/card contrast plus generous space - never from a
 * spread of colours. The board keeps functional colour so its four object
 * types stay instantly readable on the paper ground.
 *
 * Keep this file as the single source of truth for colour values.
 */
export const colors = {
  // --- paper ---
  background: '#F3EEE3', // warm cream ground
  surface: '#FBF8F1', // cards, panels, board cells - a touch lighter than the ground
  surfaceAlt: '#EAE2D2', // pressed, or a completed chip
  surfaceHi: '#FFFFFF', // the brightest tappable surface

  border: '#E4DBC8', // soft rule
  borderStrong: '#CFC3A9', // card edge / focus

  // --- ink + accent ---
  primary: '#2A251F', // ink - primary buttons are ink on cream
  secondary: '#BE5A38', // warm coral-terracotta, tuned toward Claude's own brand orange - portals, Gravity's own accent, and the app's one loud colour
  accent: '#B7892F', // ochre - target rings and stars only

  // --- per-game identity accents ---
  // One muted, distinct colour per game (Gravity's is `secondary` above,
  // already established everywhere) so each game reads as a different
  // thing at a glance - Home's hero card, each screen's kicker line, and
  // Browse's section headers - without introducing new hues that clash with
  // the functional board colours above (danger/success/accent/pieceBlue).
  mirrorAccent: '#4D6A80', // dusty steel-blue - a mirror's reflective surface
  tentsAccent: '#45684D', // muted sage-green - a pitched tent among the trees
  towersAccent: '#714B81', // dusty violet - a city skyline at dusk
  binairoAccent: '#6A713D', // dusty olive-gold - neutral, ledger-like

  // --- Skyscrapers' clue/answer split ---
  // A clue and a player's answer used to differ only by which colour token
  // they used; now they differ in family, size, weight AND colour, so the
  // distinction survives even in grayscale. `towersClueText` is deliberately
  // not `towersAccent` itself - clue and answer must never share one value.
  towersClueChip: 'rgba(113, 75, 129, 0.10)', // plaque behind each edge clue
  towersClueText: '#5A3F66',
  towersShadow: 'rgba(42, 37, 31, 0.18)', // ink-based; Tents and Trees' ground shadow shares this same ink base

  // --- Tents and Trees' ground shadow ---
  // Same ink base as `towersShadow` (a slightly lower alpha - trees and
  // tents sit lower/flatter in their cell than a skyscraper's digit) -
  // ground shadows are one visual concept in this palette, not several.
  tentsShadow: 'rgba(42, 37, 31, 0.14)',

  // --- Binairo's tactile tile board ---
  // The one board where each cell is its own raised tile rather than a
  // square on a shared flat surface. `binairoTileShadow` is the same
  // ink-based shadow *family* as `towersShadow`/`tentsShadow` above, just a
  // tighter alpha tuned for a small offset tile shadow rather than a ground
  // shadow. Every tile *face* stays this app's plain `surfaceHi` paper
  // colour regardless of value - colour never spreads across the tile
  // itself, only the mark drawn on top of it (`binairoMarkFilled`/
  // `binairoMarkOutline` below) carries it, so a filled cell never reads
  // as "this whole tile is now a different colour". A given (printed)
  // cell and a player's own entry still share the exact same mark colour -
  // they're told apart by `BinairoBoardView.tsx`'s own `TILE_SHADOW_DY`/
  // border-weight (a given tile sits more raised, with a heavier rule).
  binairoTileShadow: 'rgba(42, 37, 31, 0.18)',
  // The two fillable values' own ink - a warm gold disc, a cool blue
  // square, so colour and shape agree rather than only one of them
  // carrying the distinction (colour alone isn't colourblind-safe; shape
  // alone reads as flatter/harder to scan at speed - together they're
  // both fast to read and robust without it). Flat, solid fills, no
  // gradient or bevel - the point is to read as ink stamped on the page,
  // not a glossy game token. Reuses this app's own existing warm/cool
  // pair (`pieceBlue`'s exact blue; a gold pitched to sit clearly apart
  // from `accent`'s own ochre, so a mark is never mistaken for a hint
  // flash or a star) rather than inventing new hues.
  binairoMarkFilled: '#D99A2B',
  binairoMarkOutline: '#3E5C99',

  // --- Mirror Maze's board ---
  // The one board in the app that inverts to a dark ground. Light can only
  // read as *light* against something darker than it; on cream, a beam is
  // just a drawn line. The screen's chrome (header, controls, ground) stays
  // cream - it's the board panel alone that goes to ink, so the game still
  // sits inside the same almanac.
  mirrorPanel: '#241F1A', // warm ink wash - the board itself
  mirrorPanelCell: '#2E2822', // a faintly lit tile on that wash
  mirrorPanelEdge: '#4A4136', // hairline between tiles
  mirrorVoid: '#17130F', // an obstacle: darker than the panel, reads as a hole
  mirrorSpeckle: '#9C8E79', // faint constellation dust in the wash
  mirrorGlass: '#A8C0D4', // polished silver - a mirror the player has placed
  mirrorBeamGlow: '#7FA8C9', // the beam's blue halo
  mirrorBeamCore: '#FFF6E2', // the beam's warm-white centre

  textPrimary: '#2A251F', // ink
  textSecondary: '#726A5C', // warm grey
  textTertiary: '#9E9482', // faint warm grey
  textDisabled: '#BDB4A0',

  success: '#5C7C4A', // muted leaf green - a piece resting on its target
  warning: '#B7892F',
  danger: '#8C2318', // alarm red - hazards and failure only, kept apart from the terracotta secondary

  overlay: 'rgba(42, 37, 31, 0.32)',
  transparent: 'transparent',

  // --- board object colours (functional, tuned for the cream ground) ---
  pieceBlue: '#3E5C99', // movable object

  // Gravity zone: a faint tint + border + directional chevrons.
  zoneFill: 'rgba(62, 92, 153, 0.08)',
  zoneBorder: 'rgba(62, 92, 153, 0.34)',
  zoneArrow: 'rgba(62, 92, 153, 0.40)',
} as const;

export type ThemeColors = typeof colors;
