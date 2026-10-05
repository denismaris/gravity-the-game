import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MovableObject } from '../../engine';
import { useAnimatedMovables } from '../useAnimatedMovables';

function Probe({ movables }: { movables: ReadonlyArray<MovableObject> }): null {
  useAnimatedMovables(movables, false);
  return null;
}

test('a different board swapped in, with new pieces, does not throw', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 0, col: 2 }]} />);
  });
  expect(() =>
    act(() => {
      renderer.update(<Probe movables={[{ id: 'b', row: 2, col: 0 }]} />);
    }),
  ).not.toThrow();
  act(() => renderer.unmount());
});
