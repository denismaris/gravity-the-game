# Gravity — an almanac of puzzles

A React Native puzzle game built around one idea: pressing a direction pulls
*everything* that way, not just the piece you're thinking about. Three games
share that world, dealt out as one continuous **Journey**:

- **Gravity** — slide pieces onto their targets. Anchors pin cells in place,
  portals link two cells, gravity zones override the direction inside a
  region, and hazards end the run the instant something reaches them.
- **Constellation** — a nonogram: fill the grid to match the row/column clues
  and reveal the picture.
- **Trajectory** — a flow puzzle: connect every pair of endpoints with a
  single path that covers the whole board.

A **Daily** puzzle (one fixed pick from the whole pool, the same for everyone
on a given day) keeps a streak going independently of the Journey.

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
- `src/game/constellation/` / `src/game/trajectory/` — the same idea for the
  other two games: pure logic plus a solver used both for hints and to
  verify every hand-authored puzzle actually has (a) a solution at all and,
  for Constellation, (b) exactly one.
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
