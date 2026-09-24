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
  background: '#EDE5D3', // warm sand-cream ground
  surface: '#F8F2E5', // cards, panels, board cells - a touch lighter than the ground
  surfaceAlt: '#E3D8C0', // pressed, or a completed chip
  surfaceHi: '#FFFDF8', // the brightest tappable surface

  border: '#DFD3BA', // soft rule
  borderStrong: '#C8B894', // card edge / focus

  // The poster's own artwork ground (Pantone P 15-2 C, measured). The
  // reference does *not* flood a screen with this - it sits sand artwork
  // inside a near-white surround, which is exactly the page-vs-board split
  // this app already has. So this is the tone for board plinths and hero
  // panels, never for a whole screen: at full width it swamps text
  // contrast and reads muddy rather than warm.
  sand: '#DFCDA4',
  sandDeep: '#CDB98C',

  // --- ink + accent ---
  primary: '#3B1F52', // violet ink - primary buttons are ink on sand
  secondary: '#C46C33', // warm coral-terracotta, tuned toward Claude's own brand orange - portals, Gravity's own accent, and the app's one loud colour
  accent: '#B7892F', // ochre - target rings and stars only

  // --- per-game identity accents ---
  // One distinct colour per game (Gravity's is `secondary` above, already
  // established everywhere) so each game reads as a different thing at a
  // glance - Home's hero card, each screen's kicker line, board frames, and
  // Browse's section headers - without introducing new hues that clash with
  // the functional board colours above (danger/success/accent/pieceBlue).
  // Deepened and more saturated than this app's first pass at these four -
  // same hue family each (a mirror's still reads as steel-blue, a tent's
  // still reads as sage), just with real chroma behind it instead of a
  // dusty near-grey, so each accent actually reads as a colour choice
  // rather than a tinted neutral once it's carrying real weight (a board's
  // own frame, not just a thin kicker line).
  mirrorAccent: '#2E5A78', // steel-blue - a mirror's reflective surface
  tentsAccent: '#2C6B3C', // forest green - a pitched tent among the trees
  towersAccent: '#7E3D96', // plum-violet - a city skyline at dusk
  binairoAccent: '#8C7A1E', // mustard-gold - neutral, ledger-like

  // --- Skyscrapers' clue/answer split ---
  // A clue and a player's answer used to differ only by which colour token
  // they used; now they differ in family, size, weight AND colour, so the
  // distinction survives even in grayscale. `towersClueText` is deliberately
  // not `towersAccent` itself - clue and answer must never share one value.
  towersClueChip: 'rgba(113, 75, 129, 0.10)', // plaque behind each edge clue
  towersClueText: '#5A3F66',
  towersShadow: 'rgba(59, 31, 82, 0.18)', // ink-based; Tents and Trees' ground shadow shares this same ink base

  // --- Tents and Trees' ground shadow ---
  // Same ink base as `towersShadow` (a slightly lower alpha - trees and
  // tents sit lower/flatter in their cell than a skyscraper's digit) -
  // ground shadows are one visual concept in this palette, not several.
  tentsShadow: 'rgba(59, 31, 82, 0.14)',

  // --- Binairo's ruled tile board ---
  // The one board with its own per-cell grid rather than a flat washed
  // surface - each cell is a ruled square within the one tray the whole
  // board casts its shadow as (see `BinairoBoardView.tsx`'s own
  // `renderTray`/`renderTileChrome`), not a raised tile with a shadow of
  // its own - a shadow stacked under a border on the same small surface is
  // the "ghost card" double-elevation this app avoids everywhere else.
  // Every tile face stays a plain paper colour regardless of value -
  // colour never spreads across the tile itself, only the mark drawn on
  // top of it (`binairoMarkFilled`/`binairoMarkOutline` below) carries it,
  // so a filled cell never reads as "this whole tile is now a different
  // colour". A given (printed) cell and a player's own entry still share
  // the exact same mark colour - they're told apart by the tile face
  // itself (`surface`, a touch toned down, vs. `surfaceHi`, "the brightest
  // tappable surface" - a given cell isn't tappable) plus a heavier rule.
  // The two fillable values' own ink - a rich terracotta-orange disc, a
  // deep teal square: a genuinely warm/cool complementary pair, so colour
  // and shape agree rather than only one of them carrying the distinction
  // (colour alone isn't colourblind-safe; shape alone reads as flatter/
  // harder to scan at speed - together they're both fast to read and
  // robust without it). Replaces an earlier gold/blue pair that read as
  // flat and drab against this board's own warm paper tray - these two
  // are both saturated enough to hold their own as the board's one
  // colourful thing, and neither reads as a washed-out pastel the way the
  // old gold did. `_LIGHT`/`_DARK` give each mark a quiet top-to-bottom
  // satin gradient (see `BinairoBoardView.tsx`'s `renderCircleMark`/
  // `renderSquareMark`) - real but gentle dimension, short of a glossy
  // game-token bevel, since a flat single fill is exactly what read as
  // "boring" here.
  binairoMarkFilled: '#C1552A',
  binairoMarkFilledLight: '#E2905E',
  binairoMarkFilledDark: '#8A3A18',
  binairoMarkOutline: '#1D6B5C',
  binairoMarkOutlineLight: '#4B9C8C',
  binairoMarkOutlineDark: '#0F3F36',

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

  textPrimary: '#3B1F52', // violet ink
  textSecondary: '#6B5A7A', // violet-grey
  textTertiary: '#9A8BA6', // faint violet-grey
  textDisabled: '#BDB0C4',

  success: '#5C7C4A', // muted leaf green - a piece resting on its target
  warning: '#B7892F',
  danger: '#8C2318', // alarm red - hazards and failure only, kept apart from the terracotta secondary

  overlay: 'rgba(59, 31, 82, 0.38)',
  transparent: 'transparent',

  // --- board object colours (functional, tuned for the cream ground) ---
  pieceBlue: '#3E5C99', // movable object

  // Gravity zone: a faint tint + border + directional chevrons.
  zoneFill: 'rgba(62, 92, 153, 0.08)',
  zoneBorder: 'rgba(62, 92, 153, 0.34)',
  zoneArrow: 'rgba(62, 92, 153, 0.40)',
} as const;

export type ThemeColors = typeof colors;
