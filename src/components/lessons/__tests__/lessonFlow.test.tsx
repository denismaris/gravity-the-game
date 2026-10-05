import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLessonFlow } from '../LessonShell';

type Flow = ReturnType<typeof useLessonFlow>;

function mount(demoLength: number): () => Flow {
  let flow!: Flow;
  function Probe(): null {
    flow = useLessonFlow(2, undefined, demoLength);
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return () => flow;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a step opens with its demo, frame by frame, then hands over', () => {
  const flow = mount(2);
  expect(flow().started).toBe(false);
  act(() => flow().start());
  expect(flow().phase).toBe('watch');
  expect(flow().demoFrame).toBeNull();
  act(() => jest.advanceTimersByTime(700));
  expect(flow().demoFrame).toBe(0);
  act(() => jest.advanceTimersByTime(620));
  expect(flow().demoFrame).toBe(1);
  act(() => jest.advanceTimersByTime(900));
  expect(flow().demoFrame).toBeNull();
  expect(flow().phase).toBe('doing');
});

test('a step with no demo goes straight to the player', () => {
  const flow = mount(0);
  act(() => flow().start());
  act(() => jest.advanceTimersByTime(700));
  expect(flow().phase).toBe('doing');
});

test('a second miss plays the demo again', () => {
  const flow = mount(1);
  act(() => flow().start());
  act(() => jest.advanceTimersByTime(700 + 900));
  expect(flow().phase).toBe('doing');
  act(() => flow().wrong());
  expect(flow().phase).toBe('doing');
  act(() => flow().wrong());
  expect(flow().phase).toBe('watch');
});

test('a success moves to the next step, which opens with its own demo', () => {
  const flow = mount(1);
  act(() => flow().start());
  act(() => jest.advanceTimersByTime(700 + 900));
  act(() => flow().succeed());
  expect(flow().phase).toBe('success');
  act(() => jest.advanceTimersByTime(1300));
  expect(flow().index).toBe(1);
  expect(flow().phase).toBe('watch');
});
