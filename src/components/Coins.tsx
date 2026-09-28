import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { triggerFeedback } from '../game/rendering';
import { usePlayerProgress } from '../progression';
import { motion, theme } from '../theme';

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
export function CoinCost({ cost, muted = false }: { cost: number; muted?: boolean }): React.JSX.Element {
  return (
    <View style={[styles.cost, muted && styles.muted]}>
      <CoinGlyph size={12} />
      <Text style={styles.costText}>{cost}</Text>
    </View>
  );
}

/**
 * The balance, under a play screen's controls. When a purchase was just
 * refused it says so in place - what is missing and how to get it - rather
 * than the button silently doing nothing.
 */
export function CoinBalance({
  coins,
  shortBy = null,
  style,
}: {
  coins: number;
  /** Set for a moment after a refused purchase: how many coins were missing. */
  shortBy?: number | null;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  // A small pop whenever the balance moves, so a spend (or a payout) is
  // seen landing rather than just being a different number.
  const pop = useRef(new Animated.Value(1)).current;
  const previous = useRef(coins);
  useEffect(() => {
    if (coins !== previous.current) {
      pop.setValue(0.82);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = coins;
  }, [coins, pop]);

  return (
    <View style={[styles.balance, style]} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.balanceRow, { transform: [{ scale: pop }] }]}>
        <CoinGlyph size={14} />
        <Text style={styles.balanceText} accessibilityLabel={`${coins} coins`}>
          {coins}
        </Text>
      </Animated.View>
      {shortBy !== null && <Text style={styles.short}>{`${shortBy} MORE NEEDED · SOLVE PUZZLES TO EARN COINS`}</Text>}
    </View>
  );
}

/** A line for a completion card: what this solve paid out. */
export function CoinsEarned({ amount, style }: { amount: number; style?: StyleProp<ViewStyle> }): React.JSX.Element | null {
  if (amount <= 0) return null;
  return (
    <View style={[styles.earned, style]} accessibilityLabel={`${amount} coins earned`}>
      <CoinGlyph size={16} />
      <Text style={styles.earnedText}>{`+${amount}`}</Text>
    </View>
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

const styles = StyleSheet.create({
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
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    letterSpacing: 1,
    color: theme.colors.textSecondary,
  },
  short: {
    marginTop: 4,
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 0.8,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  earned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  earnedText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.accent,
    letterSpacing: 1,
  },
});
