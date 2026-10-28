import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, TextStyle, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { isReducedMotion, triggerFeedback, useReducedMotion } from '../game/rendering';
import { curve } from '../theme/motion';
import { usePlayerProgress } from '../progression';
import { motion, theme, themedStyles } from '../theme';

/** Figures inside a key or pill of fixed height grow only this far with
 * the player's text size: past it they clip at the key's edge. */
export const FIGURE_SCALE = 1.1;

/**
 * The coin: an ochre disc with a tessera - the app's own diamond - struck
 * into it. Flat ink and a rim ring, no gradient: a printed coin, the same
 * register as every other object on this paper.
 */
export function CoinGlyph({ size = 14 }: { size?: number }): React.JSX.Element {
  const c = size / 2;
  const d = size * 0.2;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={c} cy={c} r={c} color={theme.colors.accent} />
      <Circle cx={c} cy={c} r={c * 0.74} color="#E2B85C" style="stroke" strokeWidth={Math.max(1, size * 0.07)} />
      <Path path={`M ${c} ${c - d} L ${c + d} ${c} L ${c} ${c + d} L ${c - d} ${c} Z`} color="#FFF3D4" />
    </Canvas>
  );
}

/** What a purchase costs, set inside the pill that buys it: `Hint · ◉ 10`. */
export function CoinCost({ cost, muted = false }: { cost: number; muted?: boolean }): React.JSX.Element | null {
  // A free purchase shows no price at all.
  if (cost <= 0) return null;
  return (
    <View style={[styles.cost, muted && styles.muted]}>
      <CoinGlyph size={12} />
      <Text style={styles.costText} maxFontSizeMultiplier={FIGURE_SCALE}>{cost}</Text>
    </View>
  );
}

/**
 * The balance, under a play screen's controls. When a purchase was just
 * refused it says so in place - what is missing and how to get it - rather
 * than the button silently doing nothing.
 */
/** The balance each purse last showed, by its `track` - where it counts
 * up from next time. Kept per purse: the play screen keeps one mounted
 * (out of sight) that takes a solve's payout the moment it is paid, and
 * with one shared memory Home's purse then had nothing left to count. */
const lastShown = new Map<string, number>();

export function CoinBalance({
  coins,
  shortBy = null,
  style,
  track = 'play',
  delay = 0,
  figure,
}: {
  coins: number;
  /** The count's text style where the purse sits beside other figures. */
  figure?: StyleProp<TextStyle>;
  /** Which purse this is, for where its count starts (see `lastShown`). */
  track?: string;
  /** Wait this long before counting - for a purse on a screen still
   * arriving, so the count is seen, not missed under the entrance. */
  delay?: number;
  /** Set for a moment after a refused purchase: how many coins were missing. */
  shortBy?: number | null;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  // A small pop whenever the balance moves, so a spend (or a payout) is
  // seen landing rather than just being a different number.
  const pop = useRef(new Animated.Value(1)).current;
  const previous = useRef(coins);
  // The number itself counts up (or down) to the new balance, starting
  // from the last balance any purse showed - so coming back to Home after
  // a solve, the payout is watched arriving.
  const [shown, setShown] = useState(() => lastShown.get(track) ?? coins);
  const [flight, setFlight] = useState<{ key: number; count: number; delay: number } | null>(null);
  const glyph = useRef<React.ElementRef<typeof View>>(null);
  useEffect(() => {
    if (coins !== previous.current) {
      pop.setValue(0.82);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    const changedHere = coins !== previous.current;
    previous.current = coins;
    const from = lastShown.get(track) ?? coins;
    lastShown.set(track, coins);
    if (from === coins) {
      setShown(coins);
      return;
    }
    const duration = Math.min(900, 300 + Math.abs(coins - from) * 6);
    // A payout arriving on Home flies in first, coin by coin, and the count
    // starts as the first ones land.
    const flying = !changedHere && coins > from && track === 'home' && !isReducedMotion();
    if (flying) setFlight({ key: Date.now(), count: Math.min(7, Math.max(3, Math.ceil((coins - from) / 6))), delay });
    const wait = changedHere ? 0 : delay + (flying ? COIN_FLIGHT_MS * 0.6 : 0);
    let frame = 0;
    let start = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (coins - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      // Arrived from elsewhere (back on Home after a solve): the purse
      // pops as the count lands - the payout, seen arriving.
      else if (!changedHere) {
        // Felt and heard as it lands - the payout arriving.
        if (coins > from) triggerFeedback('coin');
        pop.setValue(0.82);
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
      }
    };
    const timer = setTimeout(() => {
      start = Date.now();
      frame = requestAnimationFrame(step);
    }, wait);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
    // `track` and `delay` are fixed for a purse's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coins, pop]);

  return (
    <View style={[styles.balance, style]} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.balanceRow, { transform: [{ scale: pop }] }]}>
        <View ref={glyph} collapsable={false}>
          <CoinGlyph size={14} />
          {flight && <CoinFlight key={flight.key} anchor={glyph} count={flight.count} delay={flight.delay} onDone={() => setFlight(null)} />}
        </View>
        <Text style={[styles.balanceText, figure]} maxFontSizeMultiplier={FIGURE_SCALE} accessibilityLabel={`${coins} coins`}>
          {shown}
        </Text>
      </Animated.View>
      {shortBy !== null && <Text style={styles.short}>{`${shortBy} more needed. Solving puzzles earns coins.`}</Text>}
    </View>
  );
}

/** From the coins' setting off to the last one landing. */
const COIN_FLIGHT_MS = 900;

/**
 * The payout arriving: a few coins rising from low in the middle of the
 * screen and arcing into the purse, one after another, each landing with a
 * light tick. Drawn from the purse's own coin, offset back to where they
 * start, so they land exactly on it. Native-driven.
 */
function CoinFlight({ anchor, count, delay, onDone }: { anchor: React.RefObject<React.ElementRef<typeof View> | null>; count: number; delay: number; onDone: () => void }): React.JSX.Element | null {
  const { width, height } = useWindowDimensions();
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const t = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    anchor.current?.measureInWindow((x: number, y: number) => setFrom({ x: width / 2 - x - 7, y: height * 0.62 - y - 7 }));
    // Once: keyed by the payout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!from) return;
    const per = (COIN_FLIGHT_MS - 520) / Math.max(1, count - 1);
    const runs = t.map((v, i) => Animated.timing(v, { toValue: 1, duration: 520, delay: delay + i * per, easing: curve.glide, useNativeDriver: true }));
    const ticks = t.map((_v, i) => setTimeout(() => triggerFeedback('tap'), delay + i * per + 500));
    Animated.parallel(runs).start(() => onDone());
    return () => ticks.forEach(clearTimeout);
  }, [from, t, count, delay, onDone]);
  if (!from) return null;
  return (
    <View pointerEvents="none" style={styles.flight}>
      {t.map((v, i) => {
        // A little spread at the start, so they leave as a handful.
        const spread = (i - (count - 1) / 2) * 14;
        return (
          <Animated.View
            key={i}
            style={[
              styles.flyer,
              {
                opacity: v.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from.x + spread, 0] }) },
                  // A bow upward on the way, not a straight line.
                  { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from.y, from.y * 0.42 - 40, 0] }) },
                  { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.5, 1.25, 0.9] }) },
                ],
              },
            ]}
          >
            <CoinGlyph size={14} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** A line for a completion card: what this solve paid out. The coin
 * pops in once the card has settled (after the stars), then the number
 * counts up to the payout with a small tick of the coin sound at the end -
 * the moment a reward should feel like one. Reduced motion shows it at
 * once. */
export function CoinsEarned({ amount, style, delay = 750 }: { amount: number; style?: StyleProp<ViewStyle>; delay?: number }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [shown, setShown] = useState(reduced ? amount : 0);
  useEffect(() => {
    if (reduced || amount <= 0) {
      setShown(amount);
      return;
    }
    let frame = 0;
    const timer = setTimeout(() => {
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
      const start = Date.now();
      const duration = Math.min(800, 280 + amount * 18);
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        setShown(Math.round(amount * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(step);
        else triggerFeedback('coin');
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [amount, delay, pop, reduced]);
  if (amount <= 0) return null;
  return (
    <Animated.View
      style={[styles.earned, style, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}
      accessibilityLabel={`${amount} coins earned`}
    >
      <CoinGlyph size={16} />
      <Text style={styles.earnedText}>{`+${shown}`}</Text>
    </Animated.View>
  );
}

const SHORT_NOTICE_MS = 2200;

/**
 * The one way a screen spends coins. `buy(cost, apply)` charges first and
 * only then runs `apply`, so a refused purchase never touches the board;
 * a refusal also sets `shortBy` for a moment, for `CoinBalance` to explain.
 */
export function useCoinPurchase(): {
  coins: number;
  shortBy: number | null;
  buy: (cost: number, apply: () => void) => boolean;
} {
  const { coins, spendCoins } = usePlayerProgress();
  const [shortBy, setShortBy] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const buy = useCallback(
    (cost: number, apply: () => void): boolean => {
      if (cost <= 0) {
        apply();
        return true;
      }
      if (!spendCoins(cost)) {
        setShortBy(cost - coins);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShortBy(null), SHORT_NOTICE_MS);
        triggerFeedback('tap');
        return false;
      }
      setShortBy(null);
      apply();
      return true;
    },
    [coins, spendCoins],
  );

  return { coins, shortBy, buy };
}

const styles = themedStyles(() => ({
  flight: { position: 'absolute', left: 0, top: 0, width: 14, height: 14, overflow: 'visible' },
  flyer: { position: 'absolute', left: 0, top: 0 },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
    paddingLeft: theme.spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  muted: { opacity: 0.45 },
  costText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
  },
  balance: {
    alignItems: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  balanceText: {
    fontFamily: theme.typography.families.figures,
    fontVariant: ['tabular-nums'],
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.semibold,
  },
  short: {
    marginTop: 4,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.secondary,
    textAlign: 'center',
    fontWeight: theme.typography.weights.semibold,
  },
  earned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  earnedText: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.accentText,
  },
}));
