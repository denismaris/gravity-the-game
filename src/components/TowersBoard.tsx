/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { computeConflicts, isColComplete, isRowComplete, TowersCell, TowersPuzzle, TowersState } from '../game/towers';
import { shade, useReducedMotion } from '../game/rendering';
import { motion, theme, themedStyles } from '../theme';

export interface TowersBoardProps {
  puzzle: TowersPuzzle;
  state: TowersState;
  /** Pixel width available for the whole board (grid + clue gutters on all
   * four sides). Always square. */
  size: number;
  selected: TowersCell | null;
  onSelectCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: TowersCell | null;
  /** The grid is finished - runs the one celebration this board has. */
  solved?: boolean;
}

/** Cell wash for a just-completed row/column: `success` at a fixed 14% -
 * hardcoded here rather than added to the theme as its own token, matching
 * how `danger`/`towersAccent` are already inlined elsewhere in this file
 * (a state tint is a usage of an existing hue, not a new one). */
const LINE_PULSE_COLOR = 'rgba(92, 124, 74, 0.14)';

const PULSE_UP: Animated.TimingAnimationConfig = { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true };
const PULSE_DOWN: Animated.TimingAnimationConfig = { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true };

function firePulse(anim: Animated.Value): void {
  anim.setValue(0);
  Animated.sequence([Animated.timing(anim, PULSE_UP), Animated.timing(anim, PULSE_DOWN)]).start();
}

/** `0,-3,3,-2,2,0` over 220ms, linear per 44ms segment - a real shake needs
 * hard steps, not one smooth curve. */
const SHAKE_KEYFRAMES = [-3, 3, -2, 2, 0];
const SHAKE_SEGMENT_MS = 220 / SHAKE_KEYFRAMES.length;

function fireShake(anim: Animated.Value): void {
  anim.setValue(0);
  Animated.sequence(
    SHAKE_KEYFRAMES.map(toValue =>
      Animated.timing(anim, { toValue, duration: SHAKE_SEGMENT_MS, easing: Easing.linear, useNativeDriver: true }),
    ),
  ).start();
}

/**
 * A Skyscrapers grid drawn with plain views, adapting `SudokuBoard`'s style
 * (hairline cells, selected-line highlight, conflict highlight) minus the
 * 3x3 box concept Skyscrapers has none of, plus a clue gutter on all four
 * sides instead of one corner - edge clues are given/fixed content (ink),
 * the heights the player types are the player-placed content
 * (`towersAccent`), matching this app's given-vs-player colour split even
 * though, unlike Sudoku, no grid cell itself is ever pre-filled.
 */
export function TowersBoard({ puzzle, state, size, selected, onSelectCell, flashCell, solved = false }: TowersBoardProps): React.JSX.Element {
  const n = puzzle.size;
  const reducedMotion = useReducedMotion();

  const layout = useMemo(() => {
    const gutter = Math.max(26, Math.round(size / (n + 2) / 1.3));
    const cell = Math.floor((size - gutter * 2) / n);
    return { gutter, cell };
  }, [size, n]);

  const conflicts = useMemo(() => computeConflicts(state), [state]);
  const selectedValue = selected ? state.values[selected.row][selected.col] : 0;

  // Row/column-complete pulse: a brief cell wash the instant a line
  // resolves (a full permutation whose clues now match) - distinct from
  // `isTowersSolved`, which asks that of every line in the grid at once.
  // Animated.Values are created lazily per row/column and cached in a
  // ref-backed Map, so a fresh puzzle (a fresh mount) starts with a clean
  // slate and an already-open puzzle never recreates an in-flight anim.
  const rowPulseAnims = useRef(new Map<number, Animated.Value>()).current;
  const colPulseAnims = useRef(new Map<number, Animated.Value>()).current;
  const getRowPulse = (r: number): Animated.Value => {
    let anim = rowPulseAnims.get(r);
    if (!anim) {
      anim = new Animated.Value(0);
      rowPulseAnims.set(r, anim);
    }
    return anim;
  };
  const getColPulse = (c: number): Animated.Value => {
    let anim = colPulseAnims.get(c);
    if (!anim) {
      anim = new Animated.Value(0);
      colPulseAnims.set(c, anim);
    }
    return anim;
  };
  const prevLineComplete = useRef<{ rows: boolean[]; cols: boolean[] }>({
    rows: Array.from({ length: n }, () => false),
    cols: Array.from({ length: n }, () => false),
  });
  useEffect(() => {
    const prev = prevLineComplete.current;
    for (let r = 0; r < n; r += 1) {
      const complete = isRowComplete(puzzle, state, r);
      if (complete && !prev.rows[r]) firePulse(getRowPulse(r));
      prev.rows[r] = complete;
    }
    for (let c = 0; c < n; c += 1) {
      const complete = isColComplete(puzzle, state, c);
      if (complete && !prev.cols[c]) firePulse(getColPulse(c));
      prev.cols[c] = complete;
    }
    // getRowPulse/getColPulse always read from a stable, ref-backed Map -
    // omitted deliberately so this only re-runs on an actual state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, puzzle, n]);

  // Conflict shake: fires once, the instant a cell newly starts
  // conflicting - not on every render while it remains conflicting.
  const shakeAnims = useRef(new Map<string, Animated.Value>()).current;
  const getShake = (key: string): Animated.Value => {
    let anim = shakeAnims.get(key);
    if (!anim) {
      anim = new Animated.Value(0);
      shakeAnims.set(key, anim);
    }
    return anim;
  };
  const prevConflicts = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    for (const key of conflicts) {
      // The shake is pure movement with no state of its own riding on it -
      // a conflicting cell's digit and building already turn `danger` red
      // regardless (see `renderClue`/`Building` below), so under reduced
      // motion this simply doesn't fire rather than needing a reduced
      // substitute.
      if (!prevConflicts.current.has(key) && !reducedMotion) fireShake(getShake(key));
    }
    prevConflicts.current = conflicts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts, reducedMotion]);

  const renderClue = (clue: number, key: string): React.JSX.Element => (
    <View key={key} style={[styles.clueCell, { width: layout.cell, height: layout.cell }]}>
      {clue !== 0 && (
        <View style={styles.clueChip}>
          <Text style={styles.clueText}>{clue}</Text>
        </View>
      )}
    </View>
  );

  const boardSize = layout.gutter * 2 + n * layout.cell;
  const wellInset = Math.max(2, layout.cell * 0.06);
  const wellBox = {
    position: 'absolute' as const,
    left: wellInset,
    top: wellInset,
    right: wellInset,
    bottom: wellInset,
    borderRadius: (layout.cell - wellInset * 2) * 0.22,
  };

  return (
    <View style={{ width: boardSize }}>
      <View style={styles.row}>
        <View style={{ width: layout.gutter }} />
        {puzzle.topClues.map((clue, c) => renderClue(clue, `top-${c}`))}
        <View style={{ width: layout.gutter }} />
      </View>

      <View style={styles.row}>
        <View style={{ width: layout.gutter }}>
          {puzzle.leftClues.map((clue, r) => renderClue(clue, `left-${r}`))}
        </View>

        <View
          style={{
            width: n * layout.cell,
            height: n * layout.cell,
            backgroundColor: theme.colors.surfaceHi,
            borderRadius: 10,
            // The grid's own frame is the board's only declared elevation
            // (a border, no shadow of its own) - tinted with `towersAccent`
            // rather than a neutral `borderStrong` so the skyline hue reads
            // on the board itself, echoing Binairo's tray frame stroke.
            borderWidth: 1.5,
            borderColor: 'rgba(126, 61, 150, 0.55)', // towersAccent at 55%
            overflow: 'hidden',
          }}
        >
          {state.values.map((line, r) => (
            <View key={`row-${r}`} style={{ flexDirection: 'row' }}>
              {line.map((value, c) => {
                const isSelected = selected?.row === r && selected?.col === c;
                const inSelectedLine = !!selected && (selected.row === r || selected.col === c);
                const matchesSelectedValue = selectedValue !== 0 && value === selectedValue && !isSelected;
                const cellKey = `${r}:${c}`;
                const hasConflict = conflicts.has(cellKey);
                const flash = flashCell && flashCell.row === r && flashCell.col === c;

                return (
                  <Animated.View
                    key={`wrap-${r}-${c}`}
                    style={{ width: layout.cell, height: layout.cell, transform: [{ translateX: getShake(cellKey) }] }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ', blank'}`}
                      onPress={() => onSelectCell(r, c)}
                      // `pressed` is folded into the same background chain
                      // rather than layered on as an overlay so a cell
                      // answers the finger on touch-down, instead of only
                      // once `selected` has made the round trip back from
                      // the parent's state. `surfaceAlt` is the palette's
                      // own declared pressed tone, and it's what a selected
                      // cell settles on anyway - so the press reads as the
                      // selection arriving early, not as a second colour.
                      style={{
                        width: layout.cell,
                        height: layout.cell,
                        alignItems: 'center',
                        // Buildings stand on the cell floor rather than
                        // floating in its middle, so a row of them reads as
                        // one skyline sitting on a common ground line.
                        justifyContent: 'flex-end',
                        paddingBottom: layout.cell * 0.11,
                      }}
                    >
                      {({ pressed }) => (
                        <>
                      {/* A framed well rather than a ruled grid cell - the
                          same inset, radius and hairline stroke as every
                          Skia board's wells, so an empty skyline reads as
                          building plots rather than a blank form. The
                          cell's state colour lives on the well, and the
                          selected well picks up the accent rim. */}
                      <View
                        pointerEvents="none"
                        style={[
                          wellBox,
                          {
                            borderWidth: isSelected ? 1.5 : 1,
                            borderColor: isSelected ? theme.colors.towersAccent : theme.colors.border,
                            backgroundColor: flash
                              ? theme.colors.accent
                              : pressed || isSelected
                              ? theme.colors.surfaceAlt
                              : hasConflict
                              ? 'rgba(140, 35, 24, 0.10)'
                              : matchesSelectedValue
                              ? 'rgba(113, 75, 129, 0.14)'
                              : inSelectedLine
                              ? theme.colors.background
                              : theme.colors.surfaceHi,
                          },
                        ]}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.linePulse, wellBox, { opacity: getRowPulse(r) }]}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.linePulse, wellBox, { opacity: getColPulse(c) }]}
                      />
                      {/* The height as a numeral too, sitting just above
                          its own roof. The skyline alone makes the clue
                          logic visible, but it leaves the exact value to
                          be counted floor by floor - which is fine for a
                          2 and genuinely slow for a 5. The label is kept
                          small and secondary so the towers still carry
                          the board. */}
                      {value !== 0 && (
                        <Text
                          style={{
                            fontFamily: theme.typography.families.display,
                            fontSize: layout.cell * 0.2,
                            fontWeight: theme.typography.weights.semibold,
                            color: hasConflict ? theme.colors.danger : theme.colors.towersClueText,
                            marginBottom: layout.cell * 0.04,
                          }}
                        >
                          {value}
                        </Text>
                      )}
                      <Building
                        value={value}
                        max={n}
                        cell={layout.cell}
                        conflict={hasConflict}
                        seed={r * 31 + c}
                        celebrate={solved && !reducedMotion}
                        celebrateDelay={(r + c) * CELEBRATE_STAGGER_MS}
                      />
                        </>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ width: layout.gutter }}>
          {puzzle.rightClues.map((clue, r) => renderClue(clue, `right-${r}`))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ width: layout.gutter }} />
        {puzzle.bottomClues.map((clue, c) => renderClue(clue, `bottom-${c}`))}
        <View style={{ width: layout.gutter }} />
      </View>
    </View>
  );
}

/**
 * One building, drawn as `value` stacked floors rather than the digit
 * `value`.
 *
 * This is the point of Skyscrapers: every clue asks how many buildings are
 * visible looking down a line, which is a question about *heights blocking
 * each other*. A grid of numerals makes the player translate each digit
 * into a height before they can answer that; a literal skyline lets them
 * read it directly, and the floors stay countable one by one when two
 * buildings are close in size.
 *
 * Floor height is derived from the grid's own maximum so the tallest
 * building always fills about 78% of its cell, in a 4x4 and a 5x5 alike -
 * a fixed per-floor size instead leaves a 5x5's towers either overflowing
 * the cell or its 4x4's looking stunted.
 *
 * Placing one springs it up from the ground: `scaleY` from 0 with a
 * matching `translateY` of `height*(1-s)/2`, which pins the base while it
 * grows (React Native has no transform-origin, and both of these stay on
 * the native driver, unlike animating `height`).
 */
/**
 * Whether the window at `index` on `floor` of the building at `seed` has
 * its light on.
 *
 * Deterministic, and deliberately not random: a window that re-rolled on
 * every render would flicker the whole skyline every time anything on the
 * board changed. Roughly two in three are lit, which is what stops a
 * building reading as a regular grid of dots - a real block at dusk is
 * patchy, and the patchiness is most of what sells it.
 */
function windowIsLit(seed: number, floor: number, index: number): boolean {
  const h = Math.imul(seed * 73856093 + floor * 19349663 + index * 83492791, 2654435761);
  // eslint-disable-next-line no-bitwise -- a hash is bitwise by definition
  return ((h >>> 16) & 0xff) % 3 !== 0;
}

/**
 * The finish: the city lights up.
 *
 * Staggered on `row + col` rather than reading order, so the wave runs
 * diagonally out from the near corner and reads as one sweep across a
 * skyline instead of line-by-line scanning. Every step lands inside
 * `SOLVE_CELEBRATION_MS`, the beat the completion card waits out: the
 * furthest building on a 7x7 starts at 12 * 34 = 408ms and its flash is
 * done by 608ms.
 */
const CELEBRATE_STAGGER_MS = 34;
const CELEBRATE_FLASH_MS = 200;

function Building({
  value,
  max,
  cell,
  conflict,
  seed,
  celebrate,
  celebrateDelay,
}: {
  value: number;
  /** Tallest building the grid allows - i.e. the puzzle's own size. */
  max: number;
  cell: number;
  conflict: boolean;
  /** Fixes this building's own window pattern - see `windowIsLit`. */
  seed: number;
  celebrate: boolean;
  celebrateDelay: number;
}): React.JSX.Element | null {
  const grow = useRef(new Animated.Value(1)).current;
  const previous = useRef(value);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!celebrate) return;
    Animated.sequence([
      Animated.delay(celebrateDelay),
      Animated.timing(flash, { toValue: 1, duration: CELEBRATE_FLASH_MS * 0.4, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: CELEBRATE_FLASH_MS * 0.6, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [celebrate, celebrateDelay, flash]);

  useEffect(() => {
    if (previous.current !== value && value !== 0) {
      grow.setValue(0);
      Animated.spring(grow, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = value;
  }, [value, grow]);

  if (value === 0) return null;

  // A wide gap between floors is what makes them countable at a glance.
  // At ~1px they visually merged into one bar and the height had to be
  // judged rather than counted, which is the whole job here.
  const floorGap = cell * 0.05;
  const floorHeight = (cell * 0.6 - floorGap * (max - 1)) / max;
  const width = cell * 0.44;
  const height = value * floorHeight + (value - 1) * floorGap;

  const base = conflict ? theme.colors.danger : theme.colors.towersBuilding;
  const roof = conflict ? shade(theme.colors.danger, 1.3) : theme.colors.towersBuildingRoof;

  // Two windows per floor, inset from both edges. Sized off the floor bar
  // rather than fixed, so they stay in proportion between a 4x4's chunky
  // towers and a 5x5's slimmer ones, and floored at a pixel so they never
  // vanish entirely on the tightest grid.
  const windowW = Math.max(1.5, width * 0.19);
  const windowH = Math.max(1.5, floorHeight * 0.44);
  const windowY = (floorHeight - windowH) / 2;
  const windowXs = [width * 0.28 - windowW / 2, width * 0.72 - windowW / 2];

  return (
    <Animated.View
      style={{
        width,
        height,
        transform: [{ scaleY: grow }, { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) }],
      }}
    >
      {/* The celebration: a warm wash in the same colour the windows are
          lit with, swelling out past the building's own edge so a whole
          skyline of them reads as the lights coming on rather than as
          each tower being outlined. Behind the floors, so the building
          keeps its own silhouette. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -width * 0.18,
          right: -width * 0.18,
          bottom: -height * 0.04,
          height: height * 1.12,
          borderRadius: width * 0.3,
          backgroundColor: theme.colors.towersWindow,
          opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
          transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.06] }) }],
        }}
      />
      {/* The sunlit side, offset down-right behind the floors so it shows
          through the gaps between them - depth from geometry rather than a
          blurred shadow, matching how this app's other boards do it. */}
      <View
        style={{
          position: 'absolute',
          left: Math.max(2, cell * 0.035),
          top: Math.max(2, cell * 0.035),
          width,
          height,
          borderRadius: 3,
          backgroundColor: shade(base, 0.62),
        }}
      />
      {Array.from({ length: value }, (_unused, floor) => (
        <View
          key={`floor-${floor}`}
          style={{
            position: 'absolute',
            left: 0,
            bottom: floor * (floorHeight + floorGap),
            width,
            height: floorHeight,
            borderRadius: 2,
            // The top floor is the roof catching the light, which gives the
            // stack a clear top edge to count down from.
            backgroundColor: floor === value - 1 ? roof : base,
          }}
        >
          {windowXs.map((wx, index) => (
            <View
              key={`w-${index}`}
              style={{
                position: 'absolute',
                left: wx,
                top: windowY,
                width: windowW,
                height: windowH,
                borderRadius: Math.min(1, windowW / 3),
                // An unlit window is not a hole - it is glass with nothing
                // behind it, so it stays a faint lift off the wall rather
                // than a dark cut-out.
                backgroundColor: windowIsLit(seed, floor, index)
                  ? theme.colors.towersWindow
                  : theme.colors.towersWindowDark,
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
  },
  clueCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.towersClueChip,
  },
  clueText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.towersClueText,
  },
  linePulse: {
    backgroundColor: LINE_PULSE_COLOR,
  },
}));
