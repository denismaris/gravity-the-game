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

  // --- Stained Glass: the lead, the clear pane, and the three glasses ---
  glassLead: '#2E2634',
  glassLeadLight: '#4A4052',
  glassClear: '#EFEBE1',
  glassClearLine: '#E2DCCD',
  glassRuby: '#B8324B',
  glassCobalt: '#2F5DA8',
  glassAmber: '#DFA02C',
  glassEmerald: '#2E7D57',
  adjacentStone: '#A39C90',
  pondStone: '#A7A196',
  gravitySand: '#E3D2A6',
  glassAccent: '#9A3A8C',

  // --- Lily Pads: the pond, the pads and the frog ---
  pondWater: '#BFDCD8',
  pondRipple: '#D6EAE6',
  lilyPad: '#5E9E4A',
  lilyPadEdge: '#3F7432',
  lilyVein: '#7DB866',
  lilyFrog: '#8CBF3F',
  lilyFrogDark: '#5C8A26',
  lilyBloom: '#F2A7B8',
  lilyAccent: '#2F8577',

  // --- Weathervanes: the roof, the vanes and the wind ---
  vaneRoof: '#E8DCC6',
  vaneMetal: '#3C3346',
  vaneMetalLight: '#6A5E77',
  vaneWind: '#7FA9C9',
  vaneAccent: '#B5652E',

  // --- Adjacent's tray and tiles ---
  adjacentTray: '#E0D4B8',
  adjacentTrayEdge: '#C8B894',
  adjacentSlot: '#D7C9A9',
  // Glazed ceramic, not plastic: earthen tones a potter would fire,
  // each a little muted so a full tray reads as one set of tiles.
  adjacentTile0: '#B85D40', // terracotta
  adjacentTile1: '#C7953D', // honey
  adjacentTile2: '#5E9A7C', // celadon
  adjacentTile3: '#3F5F98', // indigo
  adjacentTile4: '#8C4F7E', // mulberry
  adjacentGlyph: '#F4EBD8',
  adjacentGold: '#ECDCAE',

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
  arukoneFold: 'rgba(59, 31, 82, 0.16)',

  // --- Mirror Maze's board: the same paper tray as every other board ---
  mirrorPanel: '#FBF7EE',
  mirrorPanelCell: '#FFFDF8',
  mirrorPanelEdge: '#DFD3BA',
  mirrorVoid: '#C8B894',
  /** A stone: the same tile, hatched - a square the light cannot cross. */
  mirrorStone: '#EFE7D5',
  /** A ruby filter: the same tile, glazed in ruby glass. */
  mirrorRubyPane: '#F5D5DB',
  mirrorSpeckle: '#C8B894',
  /** The mirrors: steel bars. */
  mirrorGlass: '#3F6482',
  mirrorBeamGlow: '#8DB6D6',
  /** The beam's own line - the darkest of its three strokes on paper. */
  mirrorBeamCore: '#2C6894',

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
  // A desk at night: warm charcoal, the paper's own brown taken nearly to
  // black - not violet (a plum-black ground with glowing accents is the
  // look of every generated app) and never a cold neutral grey. Surfaces
  // step *up* in lightness (a lamp-lit card on the desk), which keeps
  // every "lighter = nearer" reading the light theme relies on.
  background: '#171512',
  surface: '#211E1A',
  surfaceAlt: '#2C2823',
  surfaceHi: '#27231F',

  border: '#342F29',
  borderStrong: '#4B443B',

  sand: '#29251F',
  sandDeep: '#1C1916',

  // Primary inverts: a primary button is parchment with dark type on it -
  // the same "ink on paper" object, lit the other way round.
  primary: '#EFE3CC',
  secondary: '#D29466',
  accent: '#D1AE62',
  accentText: '#D1AE62',

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
  trayLight: '#2C2823',
  trayDeep: '#1A1815',
  inkRgb: '0,0,0',
  sheen: 'rgba(255,255,255,0.07)',
  track: 'rgba(255,255,255,0.07)',
  icePlate: '#1B2A31',
  iceEdge: '#2D4651',
  iceFill: '#22363F',
  iceMark: '#5F9DB3',
  iceMarkFull: '#4DB0D4',
  creamPlate: '#3A2F21',

  // Each game's colour by lamplight: lifted enough to read on the dark
  // ground, but quieter than the light theme's - muted, never neon, so
  // a row of them reads as an almanac and not as a glowing UI kit.
  mirrorAccent: '#8CA7BD',
  tentsAccent: '#7FA884',
  towersAccent: '#B297BF',
  binairoAccent: '#C4AC62',
  arukoneAccent: '#C98892',
  fillapixAccent: '#72AEA2',
  lightsOutAccent: '#9DA4CC',
  adjacentAccent: '#C48DAE',
  bloomAccent: '#D0959F',
  mosaicAccent: '#91A4CC',
  bridgesAccent: '#77ADBE',

  lightsOutPanel: '#11142A',
  lightsOutPanelCell: '#1C2140',
  lightsOutPanelEdge: '#343C68',
  lightsOutLit: '#F5C95E',
  lightsOutLitCore: '#FFF3D4',
  lightsOutDim: '#2A3154',

  adjacentTray: '#221F1B',
  adjacentTrayEdge: '#3B352E',
  adjacentSlot: '#1A1815',
  glassLead: '#16130F',
  glassLeadLight: '#38322B',
  glassClear: '#55504A',
  glassClearLine: '#625C55',
  glassRuby: '#D24A63',
  glassCobalt: '#4C7ED0',
  glassAmber: '#EDB548',
  glassEmerald: '#4FA87C',
  adjacentStone: '#77716A',
  pondStone: '#6E6A62',
  gravitySand: '#6B5E44',
  glassAccent: '#C08DB6',
  pondWater: '#1F3A44',
  pondRipple: '#2A4A55',
  lilyPad: '#4E8C3E',
  lilyPadEdge: '#2E5A25',
  lilyVein: '#6BA857',
  lilyFrog: '#9CCB52',
  lilyFrogDark: '#6A9A30',
  lilyBloom: '#F0A0B4',
  lilyAccent: '#7DB3A6',
  vaneRoof: '#2B2722',
  vaneMetal: '#E6DCCB',
  vaneMetalLight: '#B9AEC4',
  vaneWind: '#7FB2D9',
  vaneAccent: '#CF9566',
  adjacentTile0: '#D47A57',
  adjacentTile1: '#DDAE55',
  adjacentTile2: '#7DB497',
  adjacentTile3: '#6F8DC6',
  adjacentTile4: '#AE749F',
  adjacentGlyph: '#1A1815',
  adjacentGold: '#D2BC82',

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

  bloomLooseInk: '#5A524A',
  mosaicSlotFill: 'rgba(255, 255, 255, 0.05)',
  // Dark slate, so the glazed pieces are the lit thing on it.
  mosaicSocket: '#38322B',
  mosaicGrout: '#2B2620',
  mosaicSlabEdge: '#0F0D0B',
  mosaicSocketWall: '#1C1916',

  binairoMarkFilled: '#D8683A',
  binairoMarkFilledLight: '#F0A273',
  binairoMarkFilledDark: '#9C4520',
  binairoMarkOutline: '#2F8F7C',
  binairoMarkOutlineLight: '#5DB9A6',
  binairoMarkOutlineDark: '#16524A',

  arukoneFold: 'rgba(239, 227, 204, 0.14)',

  mirrorPanel: '#27231F',
  mirrorPanelCell: '#2C2823',
  mirrorPanelEdge: '#3E3830',
  mirrorVoid: '#4B443B',
  mirrorStone: '#221F1B',
  mirrorRubyPane: '#4A2430',
  mirrorSpeckle: '#8A7C6A',
  mirrorGlass: '#B6CCDE',
  mirrorBeamGlow: '#86B0D2',
  mirrorBeamCore: '#E8F2FA',

  // Parchment ink. Tertiary still clears AA (>= 4.5:1) on every surface.
  textPrimary: '#F1E6D2',
  textSecondary: '#C2B8A9',
  textTertiary: '#A59A8C',
  textDisabled: '#5A534B',

  success: '#8DB474',
  warning: '#D9AC4E',
  danger: '#E0654B',

  overlay: 'rgba(8, 6, 4, 0.66)',
  transparent: 'transparent',

  pieceBlue: '#7E9CDB',
  zoneFill: 'rgba(126, 156, 219, 0.10)',
  zoneBorder: 'rgba(126, 156, 219, 0.40)',
  zoneArrow: 'rgba(126, 156, 219, 0.46)',
};
