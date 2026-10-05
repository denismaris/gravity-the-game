import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MovableObject } from '../../engine';
import { SlidePlan, useSlidePlan } from '../useAnimatedMovables';

let plan!: SlidePlan;
function Probe({ movables, instant = false }: { movables: ReadonlyArray<MovableObject>; instant?: boolean }): null {
  plan = useSlidePlan(movables, instant);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a move plans a slide from where each moving piece was, then settles', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 0, col: 2 }, { id: 'b', row: 4, col: 0 }]} />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'a', row: 4, col: 2 }, { id: 'b', row: 4, col: 0 }]} />));
  expect(plan.isAnimating).toBe(true);
  expect(plan.from.get('a')).toMatchObject({ row: 0, col: 2 });
  expect(plan.from.has('b')).toBe(false);
  act(() => jest.advanceTimersByTime(plan.duration));
  expect(plan.isAnimating).toBe(false);
  act(() => renderer.unmount());
});

test('a different board swapped in, with new pieces, does not slide or throw', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 0, col: 2 }]} />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'b', row: 2, col: 0 }]} />));
  expect(plan.isAnimating).toBe(false);
  expect(plan.from.size).toBe(0);
  act(() => renderer.unmount());
});

test('an instant change (undo, restart) snaps without a slide', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 4, col: 2 }]} instant />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'a', row: 0, col: 2 }]} instant />));
  expect(plan.isAnimating).toBe(false);
  expect(plan.from.size).toBe(0);
  act(() => renderer.unmount());
});
