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
  // shadow. The board's two fillable symbols (a filled disc, a hollow
  // rounded square) are both drawn in plain ink - shape carries the
  // primary distinction, not colour - so `binairoFilledTile`/
  // `binairoOutlineTile` carry the redundant colour cue instead, on the
  // tile's own face. They were originally blends of `secondary`
  // (terracotta) and `binairoAccent` (olive) - a real palette mistake,
  // not just a taste call: a pink-tinted tile and a red hazard-tape error
  // share one colour family, so a filled tile could misread as "this is
  // wrong" at a glance, and a green-tinted tile sits too close to
  // `success`'s own meaning elsewhere in the app. Rebuilt as 25% blends
  // of `pieceBlue` and `accent` (ochre) instead - a plain warm/cool pair
  // that doesn't borrow either error-red or success-green's own hue, and
  // reuses colours already meaningful elsewhere (a piece, a target/star)
  // rather than inventing new ones. All three rule violations still
  // share one plain `danger`-red hazard-tape treatment - one consistent
  // "this is wrong" language beats three - which is exactly why nothing
  // else on this board can also read as red. Bumped from a 25% blend to
  // 35%, then to 55%/75%, then to 75%/95%, still too pale each time on an
  // actual device rather than in isolation - then, once dark enough, the
  // gold side still read as a flat, slightly muddy olive-brown rather
  // than a genuinely rich colour, so `binairoFilledTile` moved off
  // `accent` entirely - first to a warmer amber, which *still* read as a
  // dull, brownish "mustard" next to the actual bubble shading rather
  // than a genuine gold, so bumped again to a brighter, more saturated
  // "sun gold" (`accent` itself stays untouched throughout -
  // stars/target rings elsewhere in the app still use it as-is).
  // `binairoOutlineTile` stays exactly `pieceBlue` at 100% - that side
  // never had the same complaint. A given (printed) cell and a player's
  // own entry share this exact same colour now - they used to differ (a
  // given tile ran a further blend toward ink, deeper/richer), but that
  // made the two symbols read as different colours rather than the same
  // colour at two depths, so the distinction moved entirely onto
  // `TILE_SHADOW_DY`/border-weight in `BinairoBoardView.tsx` (a given
  // tile still sits more raised, with a heavier rule) instead of also
  // living here.
  binairoTileShadow: 'rgba(42, 37, 31, 0.18)',
  binairoFilledTile: '#E3A828',
  binairoOutlineTile: '#3E5C99',

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
