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
  // Deep wine. Picked by where the other five already sit on the wheel
  // (roughly 25, 50, 135, 205 and 285 degrees) rather than by taste: the
  // widest gap left is the stretch between plum-violet and coral, and this
  // lands in the middle of it, so Arukone+ reads as its own game beside
  // any of them. Distinctly rosier than `danger` (a red-orange alarm),
  // which is the only other warm dark tone in the palette.
  arukoneAccent: '#9B3B52',
  // Deep teal. The numerically widest remaining gap on the wheel (between
  // Binairo's mustard-gold and Tents' forest-green) sits in yellow-green,
  // too close to both neighbours and too easily muddy - this app's own
  // standard elsewhere is a colour that reads as a deliberate choice, not
  // a tinted neutral. The next-widest gap (between Tents' forest-green and
  // Mirror Maze's steel-blue) lands here instead: a true teal, clearly
  // apart from both.
  fillapixAccent: '#1D6E63',
  // Deep indigo - the last wide gap on the wheel (between Mirror Maze's
  // steel-blue and Skyscrapers' plum-violet), and the one hue that could
  // not have gone to any other game here: Lights Out is lamps burning in
  // the dark, so its identity colour is the night they burn against. The
  // obvious choice, gold, was already spoken for twice over (Binairo's
  // mustard, `accent`'s ochre) - and gold belongs to the *lights* on this
  // board anyway (`lightsOutLit`), not to the game's chrome.
  lightsOutAccent: '#3A4A8C',
  // Orchid-magenta - the last real gap on the wheel, the stretch between
  // Skyscrapers' plum-violet and Arukone+'s wine, and by now genuinely
  // the tightest of the nine: it is ~30 degrees from each neighbour where
  // the earlier accents got 50-80. So it is pulled clear on the other two
  // axes instead of hue alone - distinctly more saturated than the plum
  // and distinctly cooler than the wine, which is what keeps the three
  // apart at kicker size. Adjacent is also the one game whose identity
  // does not really live in its chrome (its subject is a *set* of
  // colours, on the tiles), so this only ever has to hold a thin line of
  // type and a board rim, never compete with the tray it frames.
  adjacentAccent: '#A8377F',
  // Bloom's camellia rose - the one hue family the other nine left free
  // (Gravity is orange, Arukone+ a darker wine, Adjacent magenta-violet).
  // It is also what a closed loop fills with, so the game's identity and
  // its reward are the same colour.
  bloomAccent: '#C8506A',

  // --- Lights Out's board ---
  // The second board in this app to invert to a dark ground, and for the
  // same reason Mirror Maze's does: a light can only read as *lit*
  // against something darker than it. Deliberately a different dark from
  // Mirror Maze's warm ink wash - that one is a printed panel, this one
  // is night - so the two never blur together despite sharing the move.
  lightsOutPanel: '#1C2038',
  lightsOutPanelCell: '#252A45',
  lightsOutPanelEdge: '#39406A',
  // A lamp with someone home. Same warmth as `towersWindow`'s lit window
  // and for the same reason, but its own token: this is the single most
  // visible colour in the whole game, not a detail on a building.
  lightsOutLit: '#F5C95E',
  lightsOutLitCore: '#FFF3D4',
  // An unlit lamp - present, clearly still a lamp, just cold. Lifted a
  // little off the cell behind it so a dark board still reads as a grid
  // of objects rather than an empty panel.
  lightsOutDim: '#333A5C',

  // --- Adjacent's tray and tiles ---
  // A shallow sand tray the chips rest in, one step deeper than the page
  // so the board reads as a container rather than a printed area. Light,
  // unlike Mirror Maze's and Lights Out's inverted boards: nothing here
  // emits light, it is just coloured clay on a bench.
  adjacentTray: '#E0D4B8',
  adjacentTrayEdge: '#C8B894',
  // The empty square a tile has fallen out of - visibly a slot that can
  // be refilled, not a hole in the tray.
  adjacentSlot: '#D7C9A9',
  // The five glazes.
  //
  // Deliberately the same five hues this app's own game accents already
  // occupy, deepened a touch: that set was picked, one game at a time,
  // by explicitly hunting the widest remaining gap on the colour wheel,
  // which makes it the most thoroughly mutually-distinguishable palette
  // in the project - exactly the property five tiles sitting side by side
  // need. They are separate tokens rather than reuses of
  // `mirrorAccent`/`tentsAccent`/etc. on purpose: those are *identity*
  // values owned by other games, and retuning Mirror Maze's blue should
  // never silently redraw fourteen shipped Adjacent boards.
  //
  // Colour alone is not the only cue - every tile also carries its own
  // knocked-out glyph (see `AdjacentBoardView`), so the board stays
  // playable for a red-green colour-blind player, for whom the
  // terracotta and the green here would otherwise be the classic
  // confusable pair.
  adjacentTile0: '#C4632F', // terracotta
  adjacentTile1: '#B08616', // gold
  adjacentTile2: '#2F7A42', // forest green
  adjacentTile3: '#2E6285', // steel blue
  adjacentTile4: '#6B4396', // violet
  // Glyphs and highlights are knocked out in the tray's own colour, the
  // same "detail in the plate colour" rule `GameEmblem` uses, so a tile
  // reads as one flat colour with a shape cut out of it rather than as
  // two inks.
  adjacentGlyph: '#F4EBD8',

  // --- Skyscrapers' clue/answer split ---
  // A clue and a player's answer used to differ only by which colour token
  // they used; now they differ in family, size, weight AND colour, so the
  // distinction survives even in grayscale. `towersClueText` is deliberately
  // not `towersAccent` itself - clue and answer must never share one value.
  // --- Skyscrapers' buildings ---
  // The towers themselves sit deeper than `towersAccent` (which stays the
  // game's identity colour for its kicker, track and clue plaques) and
  // closer to the app's own violet ink. Two reasons: a building is a mass,
  // and a mass wants the heavier end of the hue; and lit windows only read
  // as *lit* against something dark, in exactly the way Mirror Maze's beam
  // needs its dark panel.
  towersBuilding: '#452963',
  towersBuildingRoof: '#6B4489',
  // A window with someone home. Warmer and brighter than `accent`, which
  // is reserved for stars and target rings - this needs to read as lamp
  // light at dusk, not as ochre ink.
  towersWindow: '#F5C95E',
  towersWindowDark: 'rgba(255, 244, 214, 0.13)',

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

  // --- Arukone+'s board ---
  // An obstacle is the one thing on this board that is not paper: a cell
  // stopped out in ink rather than tinted, since a path has to read as
  // *unable* to enter it, not discouraged from it. Warm rather than a
  // neutral grey - a cool grey square on cream paper looks like a hole
  // punched in the design instead of part of it.
  arukoneObstacle: '#4A4038',
  arukoneObstacleEdge: '#635749',
  // The fold line the whole board is symmetric about, drawn down the
  // middle. Faint on purpose: the player never has to act on it, it just
  // explains why the other half keeps moving on its own.
  arukoneFold: 'rgba(59, 31, 82, 0.16)',

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
  // Deepened from an earlier `#9A8BA6` - real captions across Home,
  // Settings, Achievements, Binairo and Tents were being set in this
  // colour, and that lighter value measured 2.5-3.1:1 against the
  // surfaces it actually sits on (background/surface/surfaceHi) - well
  // under WCAG AA's 4.5:1 for real text. This value measures 4.85-5.99:1
  // against those same three grounds. Still the same violet-grey family,
  // still visibly quieter than `textSecondary` in most contexts, just no
  // longer illegible.
  textTertiary: '#6E5B7C',
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
