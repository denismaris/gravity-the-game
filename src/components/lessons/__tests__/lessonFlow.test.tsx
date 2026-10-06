import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLessonFlow } from '../LessonShell';

type Flow = ReturnType<typeof useLessonFlow>;

function mount(): () => Flow {
  let flow!: Flow;
  function Probe(): null {
    flow = useLessonFlow(2);
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return () => flow;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('each step is the player turn straight away; a miss only nudges', () => {
  const flow = mount();
  act(() => flow().start());
  expect(flow().phase).toBe('doing');
  act(() => flow().wrong());
  expect(flow().phase).toBe('doing');
  expect(flow().wrongNonce).toBe(1);
});

test('a success holds for a beat, then the next step, then done', () => {
  const flow = mount();
  act(() => flow().start());
  act(() => flow().succeed());
  expect(flow().phase).toBe('success');
  act(() => jest.advanceTimersByTime(1300));
  expect(flow().index).toBe(1);
  expect(flow().phase).toBe('doing');
  act(() => flow().succeed());
  act(() => jest.advanceTimersByTime(1300));
  expect(flow().phase).toBe('done');
});
