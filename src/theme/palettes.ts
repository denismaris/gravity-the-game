/**
 * The two palettes: the almanac by daylight, and the same almanac by
 * lamplight.
 *
 * Dark is not the light palette inverted. It is the same printed object at
 * night - the ground is the violet ink itself, deepened almost to black
 * but kept warm (never a cold grey), the paper becomes lamp-lit card, and
 * the ink becomes parchment. The one loud coral, the ochre gold and every
 * game's own colour are lifted, not kept: a hue tuned to sit on cream goes
 * muddy on a dark ground, so each is raised in lightness until it reads as
 * the same colour glowing rather than the same colour drowning.
 *
 * Every token exists in both, by type - a key added to one and not the
 * other fails to compile.
 */

export const lightColors = {
  // --- paper ---
  background: '#EDE5D3', // warm sand-cream ground
  surface: '#F8F2E5', // cards, panels, board cells - a touch lighter than the ground
  surfaceAlt: '#E3D8C0', // pressed, or a completed chip
  surfaceHi: '#FFFDF8', // the brightest tappable surface

  border: '#DFD3BA', // soft rule
  borderStrong: '#C8B894', // card edge / focus

  // The poster's own artwork ground (Pantone P 15-2 C, measured) - for
  // board plinths and hero panels, never a whole screen.
  sand: '#DFCDA4',
  sandDeep: '#CDB98C',

  // --- ink + accent ---
  primary: '#3B1F52', // violet ink - primary buttons are ink on sand
  secondary: '#C46C33', // warm coral-terracotta - the app's one loud colour
  accent: '#B7892F', // ochre - target rings and stars only
  /** Gold used as *text*: deep enough to read on cream (4.5:1 on the
   * ground), where the bright ochre above, made for stars and rings,
   * reads only 2.5:1. */
  accentText: '#86601A',

  /** Ink for the page's printed artwork (leaves, stems, rules) - the same
   * violet as `primary` by day; a quieter tone of its own by night, so
   * the artwork recedes behind the content rather than glaring. */
  artInk: '#3B1F52',
  /** What casts every shadow. */
  shadow: '#3B1F52',
  /** Gold as *type* - the golden-puzzle and Weekly Grand labels. */
  gold: '#8A6420',
  /** The gilt edge round anything golden. */
  goldRim: '#D9AE55',
  /** A golden chip's own fill, and the text on it. */
  goldFill: '#8A6420',
  onGold: '#FFF3D4',
  /** The app's own tile - the launch mark and the masthead logo. */
  brandTile: '#3B1F52',

  // --- light and depth on paper ---
  /** The lit top edge of a bar that floats over the page. */
  highlightEdge: '#FBF6EB',
  /** A tray's satin face: its lit corner and its far corner. */
  trayLight: '#FFFFFF',
  trayDeep: '#EFE9DC',
  /** The ink every shadow, dent and pressed wash is mixed from - as
   * "r,g,b", for `inkWash`. */
  inkRgb: '59,31,82',
  /** A sweep of light across a card. */
  sheen: 'rgba(255,255,255,0.5)',
  /** An empty progress track. */
  track: 'rgba(255,253,248,0.55)',
  /** The streak freeze's ice plate, and the lucky charm's cream one. */
  icePlate: '#EAF3F4',
  iceEdge: '#C6DEE3',
  iceFill: '#D5E9EE',
  iceMark: '#7FB4C6',
  iceMarkFull: '#2E7FA0',
  creamPlate: '#F6EBCB',

  // --- per-game identity accents ---
  mirrorAccent: '#2E5A78', // steel-blue
  tentsAccent: '#2C6B3C', // forest green
  towersAccent: '#7E3D96', // plum-violet
  binairoAccent: '#8C7A1E', // mustard-gold
  arukoneAccent: '#9B3B52', // deep wine
  fillapixAccent: '#1D6E63', // deep teal
  lightsOutAccent: '#3A4A8C', // deep indigo
  adjacentAccent: '#A8377F', // orchid-magenta
  bloomAccent: '#C8506A', // camellia rose
  mosaicAccent: '#2F5DAF', // lapis
  bridgesAccent: '#1683A6', // harbour blue

  // --- Lights Out's board (a night panel in both themes) ---
  lightsOutPanel: '#1C2038',
  lightsOutPanelCell: '#252A45',
  lightsOutPanelEdge: '#39406A',
  lightsOutLit: '#F5C95E',
  lightsOutLitCore: '#FFF3D4',
  lightsOutDim: '#333A5C',

  // --- Adjacent's tray and tiles ---
  adjacentTray: '#E0D4B8',
  adjacentTrayEdge: '#C8B894',
  adjacentSlot: '#D7C9A9',
  adjacentTile0: '#C4632F', // terracotta
  adjacentTile1: '#B08616', // gold
  adjacentTile2: '#2F7A42', // forest green
  adjacentTile3: '#2E6285', // steel blue
  adjacentTile4: '#6B4396', // violet
  adjacentGlyph: '#F4EBD8',

  // --- Skyscrapers ---
  towersBuilding: '#452963',
  towersBuildingRoof: '#6B4489',
  towersWindow: '#F5C95E',
  towersWindowDark: 'rgba(255, 244, 214, 0.13)',
  towersClueChip: 'rgba(113, 75, 129, 0.10)',
  towersClueText: '#5A3F66',
  towersShadow: 'rgba(59, 31, 82, 0.18)',

  // --- Tents and Trees ---
  tentsShadow: 'rgba(59, 31, 82, 0.14)',
  treeCanopy: '#425237',
  treeCanopyOutline: 'rgba(24, 30, 18, 0.5)',
  treeTrunk: '#5A4632',
  tentLight: '#557A5D',
  tentDark: '#345140',

  // --- Bloom's loose line ends ---
  bloomLooseInk: '#B1A4B6',
  // --- Mosaic's empty slot, and the grout bed the picture is set in ---
  mosaicSlotFill: 'rgba(255, 253, 248, 0.6)',
  mosaicSocket: '#E7D9B5',
  mosaicGrout: '#CDB98C',
  mosaicSlabEdge: '#B29D6C',
  mosaicSocketWall: '#C9B685',

  // --- Binairo's marks ---
  binairoMarkFilled: '#C1552A',
  binairoMarkFilledLight: '#E2905E',
  binairoMarkFilledDark: '#8A3A18',
  binairoMarkOutline: '#1D6B5C',
  binairoMarkOutlineLight: '#4B9C8C',
  binairoMarkOutlineDark: '#0F3F36',

  // --- Arukone+ ---
  arukoneObstacle: '#4A4038',
  arukoneObstacleEdge: '#635749',
  arukoneFold: 'rgba(59, 31, 82, 0.16)',

  // --- Mirror Maze's board (a dark panel in both themes) ---
  mirrorPanel: '#241F1A',
  mirrorPanelCell: '#2E2822',
  mirrorPanelEdge: '#4A4136',
  mirrorVoid: '#17130F',
  mirrorSpeckle: '#9C8E79',
  mirrorGlass: '#A8C0D4',
  mirrorBeamGlow: '#7FA8C9',
  mirrorBeamCore: '#FFF6E2',

  // --- type ---
  textPrimary: '#3B1F52', // violet ink
  textSecondary: '#6B5A7A', // violet-grey
  textTertiary: '#6E5B7C', // AA on every paper ground (4.85-5.99:1)
  textDisabled: '#BDB0C4',

  success: '#5C7C4A', // muted leaf green
  warning: '#B7892F',
  danger: '#8C2318', // alarm red - hazards and failure only

  overlay: 'rgba(59, 31, 82, 0.38)',
  transparent: 'transparent',

  // --- Gravity's board objects ---
  pieceBlue: '#3E5C99',
  zoneFill: 'rgba(62, 92, 153, 0.08)',
  zoneBorder: 'rgba(62, 92, 153, 0.34)',
  zoneArrow: 'rgba(62, 92, 153, 0.40)',
};

export type ColorToken = keyof typeof lightColors;
export type Palette = Readonly<Record<ColorToken, string>>;

export const darkColors: Palette = {
  // --- the page at night ---
  // The ground is the violet ink itself, taken almost to black - warm,
  // faintly plum, never a neutral grey. Surfaces step *up* in lightness
  // (lamp-lit card on a dark desk), which keeps every "lighter = nearer"
  // reading the light theme already relies on.
  background: '#15101B',
  surface: '#201927',
  surfaceAlt: '#2C2335',
  surfaceHi: '#282030',

  border: '#342A3E',
  borderStrong: '#4F4259',

  sand: '#2A2231',
  sandDeep: '#1D1723',

  // Primary inverts: a primary button is parchment with dark type on it -
  // the same "ink on paper" object, lit the other way round.
  primary: '#EFE3CC',
  secondary: '#E08A52',
  accent: '#D9AC4E',
  accentText: '#D9AC4E',

  artInk: '#3A2C49',
  shadow: '#000000',
  gold: '#E2B85C',
  goldRim: '#C99A3E',
  goldFill: '#6E4F17',
  onGold: '#FFF3D4',
  // The brand violet, lifted a step so the tile still reads as a tile on
  // a ground that is itself nearly that violet.
  brandTile: '#4B2F68',

  highlightEdge: 'rgba(255,255,255,0.06)',
  trayLight: '#2E2538',
  trayDeep: '#1B1521',
  inkRgb: '0,0,0',
  sheen: 'rgba(255,255,255,0.07)',
  track: 'rgba(255,255,255,0.07)',
  icePlate: '#1B2A31',
  iceEdge: '#2D4651',
  iceFill: '#22363F',
  iceMark: '#5F9DB3',
  iceMarkFull: '#4DB0D4',
  creamPlate: '#3A2F21',

  // Each game's colour, lifted until it glows on the dark ground.
  mirrorAccent: '#7FA9CB',
  tentsAccent: '#6DB07E',
  towersAccent: '#B887D0',
  binairoAccent: '#CDB44E',
  arukoneAccent: '#D9768E',
  fillapixAccent: '#55B8A8',
  lightsOutAccent: '#8E9BE0',
  adjacentAccent: '#DA75B8',
  bloomAccent: '#E8839A',
  mosaicAccent: '#7B9DE6',
  bridgesAccent: '#4DB8DA',

  lightsOutPanel: '#11142A',
  lightsOutPanelCell: '#1C2140',
  lightsOutPanelEdge: '#343C68',
  lightsOutLit: '#F5C95E',
  lightsOutLitCore: '#FFF3D4',
  lightsOutDim: '#2A3154',

  adjacentTray: '#241C2B',
  adjacentTrayEdge: '#3F3349',
  adjacentSlot: '#1B1521',
  adjacentTile0: '#D8743D',
  adjacentTile1: '#CFA232',
  adjacentTile2: '#4B9A5E',
  adjacentTile3: '#4C86B0',
  adjacentTile4: '#8C63BC',
  adjacentGlyph: '#1B1521',

  towersBuilding: '#5B3B7D',
  towersBuildingRoof: '#8660A6',
  towersWindow: '#F5C95E',
  towersWindowDark: 'rgba(255, 244, 214, 0.10)',
  towersClueChip: 'rgba(200, 160, 222, 0.12)',
  towersClueText: '#D2BCDE',
  towersShadow: 'rgba(0, 0, 0, 0.40)',

  tentsShadow: 'rgba(0, 0, 0, 0.34)',
  // A grove by moonlight: lifted greens and bark, so the trees and tents
  // stand off a dark cell instead of sinking into it.
  treeCanopy: '#6B8E57',
  treeCanopyOutline: 'rgba(0, 0, 0, 0.45)',
  treeTrunk: '#8C6D4D',
  tentLight: '#7DAA86',
  tentDark: '#507A5E',

  bloomLooseInk: '#5C4E68',
  mosaicSlotFill: 'rgba(255, 255, 255, 0.05)',
  // Dark slate, so the glazed pieces are the lit thing on it.
  mosaicSocket: '#3D3348',
  mosaicGrout: '#2E2637',
  mosaicSlabEdge: '#0F0B13',
  mosaicSocketWall: '#1C1622',

  binairoMarkFilled: '#D8683A',
  binairoMarkFilledLight: '#F0A273',
  binairoMarkFilledDark: '#9C4520',
  binairoMarkOutline: '#2F8F7C',
  binairoMarkOutlineLight: '#5DB9A6',
  binairoMarkOutlineDark: '#16524A',

  arukoneObstacle: '#0E0A12',
  arukoneObstacleEdge: '#2E2537',
  arukoneFold: 'rgba(239, 227, 204, 0.14)',

  mirrorPanel: '#0F0C10',
  mirrorPanelCell: '#1A1519',
  mirrorPanelEdge: '#3A3138',
  mirrorVoid: '#070507',
  mirrorSpeckle: '#8A7C6A',
  mirrorGlass: '#B6CCDE',
  mirrorBeamGlow: '#86B0D2',
  mirrorBeamCore: '#FFF6E2',

  // Parchment ink. Tertiary still clears AA (>= 4.5:1) on every surface.
  textPrimary: '#F1E6D2',
  textSecondary: '#C3B4CC',
  textTertiary: '#A897B4',
  textDisabled: '#5E5068',

  success: '#8DB474',
  warning: '#D9AC4E',
  danger: '#E0654B',

  overlay: 'rgba(6, 3, 10, 0.66)',
  transparent: 'transparent',

  pieceBlue: '#7E9CDB',
  zoneFill: 'rgba(126, 156, 219, 0.10)',
  zoneBorder: 'rgba(126, 156, 219, 0.40)',
  zoneArrow: 'rgba(126, 156, 219, 0.46)',
};
