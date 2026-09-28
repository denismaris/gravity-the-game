# Tessera — an almanac of puzzles

A *tessera* is one tile of a mosaic. This is a React Native collection of
eight of them: eight puzzle games sharing one hub, one palette and one set
of rules about how a puzzle should feel.

- **Gravity** — slide pieces onto their targets; a press pulls *everything*
  that way, not just the piece you had in mind. Anchors pin cells in place,
  portals link two cells, gravity zones override the direction inside a
  region, and hazards end the run the instant something reaches them.
- **Mirror Maze** — place and rotate mirrors to route a beam through every
  gem to its target.
- **Tents and Trees** — pitch a tent beside every tree so each row and
  column's count matches, with no two tents touching.
- **Skyscrapers** — fill the grid with each height exactly once per row and
  column, matching the visibility clues around the edge.
- **Binairo** — fill every cell with one of two symbols so no three in a row
  repeat, each line splits evenly, and no two lines match - some puzzles add
  `=`/`x` constraint tiles between adjacent cells too.
- **Arukone+** — join each pair of numbers with a path, filling every cell.
- **Fill-a-Pix** — each clue counts the filled cells in its own square; the
  finished grid is a picture.
- **Lights Out** — every tap flips a cell and its neighbours; turn them all
  off.

Progress is dealt in **levels**: a batch of three to five puzzles drawn from
random games on a difficulty curve, with a deliberately hard *challenge*
puzzle planted every sixth one and announced before you open it. There is no
level select — see `src/progression/batches.ts` for why.

A **Daily** puzzle (one fixed pick from the whole pool, the same for everyone
on a given day) keeps a streak going independently of that.

The palette and the geometric marks come from the `bloom` poster in
`android/design-reference` — sand, violet and terracotta, measured off it
rather than eyeballed.

The icon is a Portuguese *azulejo* — the eight-pointed star-and-cross, in
magenta, tin-white and ochre. Its magenta sits between two of the app's own
accents so it belongs to the family without being any one game's colour. A
tessera is one tile of a mosaic,
and this pattern only resolves as a wall: the centre star is whole, the
corner stars are quarters their neighbours would complete, and the motif
runs off every edge. `tools/make_icon.py` regenerates every icon asset for
both platforms and carries the reasoning, including the four marks built
and rejected before it.

## Running it

```sh
npm install

# Android
npm run android

# iOS (after `bundle install` once, then before every native dependency change)
bundle exec pod install
npm run ios
```

Metro (the JS bundler) starts automatically with either command; run it on
its own with `npm start` if you need to reconnect a device.

```sh
npm test        # jest — the whole engine is unit-tested, no device needed
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

## How it's built

- `src/game/engine/` — the Gravity rules (`applyGravity`, `isPuzzleSolved`,
  `isPuzzleFailed`, undo/restart history). Pure TypeScript, zero React,
  fully unit-tested — this is the one place that knows what a legal move is.
- `src/game/mirror/`, `src/game/tents/`, `src/game/towers/`,
  `src/game/binairo/` — the same idea for the other four games: pure logic
  plus a solver used both for hints and to verify every hand-authored puzzle
  actually has a solution, and for most of them, exactly one.
- `src/game/levels/`, `src/game/worlds/`, `src/game/journey/` — level data,
  the worlds they're grouped into, and the interleaved Journey/Daily
  selection built on top of it. All plain, testable data.
- `src/game/rendering/` — Gravity's board is drawn with Skia primitives
  (`@shopify/react-native-skia`), independent of the engine that computes
  positions; `useAnimatedMovables` turns the engine's instant results into a
  short slide for display only.
- `src/progression/` — player progress (stars, best scores, the Daily
  streak), persisted through a swappable storage backend.
- `src/screens/`, `src/components/` — the RN UI. Screens own input handling
  and read the engine/progression state; they never implement game rules
  themselves.

Design direction: a warm, printed-almanac feel — cream paper, ink text, a
restrained amount of colour, and a serif wordmark. `src/theme/` is the single
source of truth for the palette and type scale.
