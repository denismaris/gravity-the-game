import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { VanesBoard } from '../VanesBoard';
import { LilyPadsBoard } from '../LilyPadsBoard';
import { GlassBoard } from '../GlassBoard';
import { ArukoneBoard } from '../ArukoneBoard';
import { MosaicPlay } from '../MosaicPlay';
import { getVanesById, initialVaneState, VANE_ROOFS } from '../../game/vanes';
import { getLilyById, hopsFrom, initialLilyState, LILY_PONDS } from '../../game/lilypads';
import { getGlassWindow, GLASS_WINDOWS, initialGlassState } from '../../game/glass';
import { ARUKONE, emptyArukoneState } from '../../game/arukone';
import { initialMosaicState, MOSAIC } from '../../game/mosaic';

/**
 * The five boards played by drag or by a canvas-wide touch, played instead
 * the way VoiceOver and TalkBack play them: through one labelled button a
 * cell, each doing that cell's move when activated. Before, each of these
 * boards was a single labelled picture with nothing in it to play.
 */

type Renderer = ReactTestRenderer.ReactTestRenderer;

/** Every screen-reader button on the board, by its label. */
function buttons(renderer: Renderer) {
  return renderer.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && typeof n.props.onPress === 'function' && n.props.accessibilityRole === 'button', { deep: false });
}

async function render(element: React.ReactElement): Promise<Renderer> {
  let renderer!: Renderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  // Let the screen reader check resolve and the board re-render with it.
  await act(async () => {
    await Promise.resolve();
  });
  return renderer;
}

describe('boards played with a screen reader', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
  });
  afterEach(() => jest.restoreAllMocks());

  test('Weathervanes: a vane turns on a double tap', async () => {
    const puzzle = getVanesById(VANE_ROOFS[0].id)!;
    const onTurn = jest.fn();
    const r = await render(<VanesBoard puzzle={puzzle} state={initialVaneState(puzzle)} size={360} solved={false} onTurn={onTurn} />);
    const vanes = buttons(r).filter(b => b.props.accessibilityLabel.startsWith('Vane,'));
    expect(vanes).toHaveLength(puzzle.vanes.length);
    const free = puzzle.fixed.findIndex(f => f === null);
    act(() => vanes[free].props.onPress());
    expect(onTurn).toHaveBeenCalledWith(free);
  });

  test('Lily Pads: the frog hops to a pad in reach', async () => {
    const puzzle = getLilyById(LILY_PONDS[0].id)!;
    const state = initialLilyState(puzzle);
    const reach = hopsFrom(puzzle, state);
    const onHop = jest.fn();
    const r = await render(<LilyPadsBoard puzzle={puzzle} state={state} size={360} solved={false} reach={reach} cutOff={[]} stranded={false} onHop={onHop} />);
    const inReach = buttons(r).filter(b => b.props.accessibilityLabel.includes('in reach'));
    expect(inReach.length).toBe(reach.length);
    act(() => inReach[0].props.onPress());
    expect(onHop).toHaveBeenCalledTimes(1);
    expect(reach).toContain(onHop.mock.calls[0][0]);
  });

  test('Stained Glass: every pane is one button, and glazes on a double tap', async () => {
    const puzzle = getGlassWindow(GLASS_WINDOWS[0].id)!;
    const onStroke = jest.fn();
    const r = await render(<GlassBoard puzzle={puzzle} state={initialGlassState(puzzle)} size={360} solved={false} onStroke={onStroke} />);
    const panes = buttons(r).filter(b => b.props.accessibilityLabel.startsWith('Pane of'));
    expect(panes).toHaveLength(puzzle.panes);
    const free = puzzle.given.findIndex(g => g === null);
    const pane = panes.find(b => !b.props.accessibilityState?.disabled)!;
    act(() => pane.props.onPress());
    expect(onStroke).toHaveBeenCalledWith(expect.any(Number), 'start');
    expect(free).toBeGreaterThanOrEqual(0);
  });

  test('Twinpath: a number takes its path up, and a square next to it draws it on', async () => {
    const puzzle = ARUKONE[0];
    let state = emptyArukoneState();
    const onChange = jest.fn(next => {
      state = next;
    });
    const onReject = jest.fn();
    const board = () => <ArukoneBoard puzzle={puzzle} state={state} size={360} solved={false} onChange={onChange} onReject={onReject} />;
    const r = await render(board());
    expect(buttons(r)).toHaveLength(puzzle.size * puzzle.size);
    // Each cell's button, in reading order: find a number by trying each.
    let started = -1;
    const all = buttons(r);
    for (let i = 0; i < all.length && started < 0; i += 1) {
      act(() => all[i].props.onPress());
      if (onChange.mock.calls.length > 0) started = i;
    }
    expect(started).toBeGreaterThanOrEqual(0);
    await act(async () => {
      r.update(board());
    });
    // A neighbour of that number, on the board, extends the path.
    const size = puzzle.size;
    const row = Math.floor(started / size);
    const col = started % size;
    const neighbours = [[row, col + 1], [row, col - 1], [row + 1, col], [row - 1, col]].filter(([y, x]) => y >= 0 && x >= 0 && y < size && x < size);
    const before = onChange.mock.calls.length;
    for (const [y, x] of neighbours) {
      act(() => buttons(r)[y * size + x].props.onPress());
      if (onChange.mock.calls.length > before) break;
      await act(async () => {
        r.update(board());
      });
    }
    expect(onChange.mock.calls.length).toBeGreaterThan(before);
  });

  test('Mosaic: a piece picked up from the tray is set on the picture', async () => {
    const puzzle = MOSAIC[0];
    const state = initialMosaicState(puzzle);
    const onPlace = jest.fn();
    const props = { puzzle, state, width: 360, maxBoardHeight: 360, solved: false, onPlace, onLift: jest.fn(), onRotate: jest.fn() };
    const r = await render(<MosaicPlay {...props} />);
    const tray = buttons(r).filter(b => b.props.accessibilityLabel.startsWith('Piece '));
    expect(tray.length).toBeGreaterThan(0);
    expect(tray[0].props.accessibilityActions).toEqual([{ name: 'turn', label: 'Turn' }]);
    act(() => tray[0].props.onPress());
    await act(async () => {
      r.update(<MosaicPlay {...props} />);
    });
    // Somewhere on the picture it fits: setting it there places it.
    const squares = buttons(r).filter(b => b.props.accessibilityLabel.startsWith('Row '));
    for (const square of squares) {
      act(() => square.props.onPress());
      if (onPlace.mock.calls.length > 0) break;
    }
    expect(onPlace).toHaveBeenCalledTimes(1);
  });
});
