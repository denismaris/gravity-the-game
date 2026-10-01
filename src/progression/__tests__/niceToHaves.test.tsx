import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import Sound from 'react-native-sound';
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';
import { FEATURED_DISCOUNT, buyCosmetic, cosmeticById, featuredItem, priceFor } from '../shop';
import { PressableScale } from '../../components';
import { triggerSound } from '../../game/rendering';

describe("today's feature", () => {
  const morning = new Date('2026-10-02T06:00:00Z');
  const night = new Date('2026-10-02T23:30:00Z');

  test('is one item all day, sold a fifth off in tidy tens', () => {
    const item = featuredItem(morning);
    expect(featuredItem(night).id).toBe(item.id);
    expect(item.exclusive).toBeUndefined();
    expect(priceFor(item, morning)).toBe(Math.round((item.price * (1 - FEATURED_DISCOUNT)) / 10) * 10);
    expect(priceFor(item, morning) % 10).toBe(0);
  });

  test('changes from day to day, and only the feature is discounted', () => {
    const days = Array.from({ length: 14 }, (_v, i) => featuredItem(new Date(Date.UTC(2026, 9, 1 + i))).id);
    expect(new Set(days).size).toBeGreaterThan(5);
    const other = cosmeticById(days[0] === 'confetti-gold' ? 'confetti-aurora' : 'confetti-gold')!;
    expect(priceFor(other, new Date(Date.UTC(2026, 9, 1)))).toBe(other.price);
  });

  test('is bought at the feature price', () => {
    const item = featuredItem(morning);
    const p = buyCosmetic({ ...emptyProgress(), coins: 5000 }, item.id, morning)!;
    expect(p.coins).toBe(5000 - priceFor(item, morning));
  });
});

describe('the savings goal', () => {
  test('is cleared by buying it, and survives a relaunch until then', () => {
    const p: PlayerProgress = { ...emptyProgress(), coins: 5000, shopGoal: 'ball-opal' };
    expect(parseProgress(JSON.stringify(p)).shopGoal).toBe('ball-opal');
    expect(buyCosmetic(p, 'ball-opal', new Date('2020-01-01'))!.shopGoal).toBeNull();
    expect(buyCosmetic(p, 'ball-coral', new Date('2020-01-01'))!.shopGoal).toBe('ball-opal');
  });
});

test("today's solves round-trip, and an old save reads as none", () => {
  const p: PlayerProgress = { ...emptyProgress(), today: { dayKey: '2026-10-02', solves: 5 } };
  expect(parseProgress(JSON.stringify(p)).today).toEqual({ dayKey: '2026-10-02', solves: 5 });
  expect(parseProgress(JSON.stringify({ ...p, today: undefined })).today).toEqual({ dayKey: '', solves: 0 });
});

describe('sound', () => {
  test('a button press is felt, not heard', () => {
    const play = jest.spyOn(Sound.prototype, 'play');
    let r!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      r = ReactTestRenderer.create(<PressableScale accessibilityLabel="b" onPress={() => {}} />);
    });
    const button = r.root.find(n => typeof n.props.onPressIn === 'function' && n.props.accessibilityLabel === 'b');
    act(() => button.props.onPressIn({}));
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  test('the same sound fired in a burst plays once', () => {
    const play = jest.spyOn(Sound.prototype, 'play');
    triggerSound('arukoneStep');
    triggerSound('arukoneStep');
    triggerSound('arukoneStep');
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
});
