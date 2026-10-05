import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { GIFT_COINS, GIFT_DAYS, Gift, LUCKY_CHARM_CHARGES } from '../progression';
import { motion, theme, themedStyles } from '../theme';
import { CoinGlyph, CoinsEarned } from './Coins';
import { PressableScale } from './PressableScale';

/**
 * The day's gift, on the first visit of the day: the week of gifts as a
 * strip of seven tickets (the days already taken are ticked, today's is
 * lifted, the seventh is gilt), what today's pays, and one button to take
 * it. The strip is the point - it shows how close the big one is.
 */
export function DailyGiftCard({ gift, onCollect }: { gift: Gift; onCollect: () => void }): React.JSX.Element {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    triggerFeedback('uiPage');
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.sequence([Animated.delay(240), Animated.spring(lift, { toValue: 1, useNativeDriver: true, ...motion.spring.pop })]).start();
  }, [enter, lift, reduced]);

  const total = gift.coins + gift.welcomeBack;
  const last = gift.day === GIFT_DAYS;
  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.scrim, { opacity: enter }]} />
      <Animated.View
        style={[
          styles.card,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) }] },
        ]}
      >
        <Text style={styles.kicker}>{gift.welcomeBack > 0 ? 'WELCOME BACK' : "TODAY'S GIFT"}</Text>
        <Text style={styles.title}>{last ? 'The seventh day' : `Day ${gift.day} of ${GIFT_DAYS}`}</Text>
        <Text style={styles.body}>
          {last
            ? 'A full week. The best gift of the lot, and the week starts again tomorrow.'
            : gift.welcomeBack > 0
              ? 'Good to see you again. Something extra for coming back.'
              : 'Open the almanac each day and the gifts grow. Miss a day and the week starts over.'}
        </Text>

        <View style={styles.week} accessible accessibilityLabel={`Day ${gift.day} of a ${GIFT_DAYS} day week of gifts`}>
          {GIFT_COINS.map((coins, i) => {
            const day = i + 1;
            const past = day < gift.day;
            const today = day === gift.day;
            const gilt = day === GIFT_DAYS;
            const ticket = (
              <View style={[styles.ticket, past && styles.ticketPast, gilt && styles.ticketGilt, today && styles.ticketToday]}>
                <Text style={[styles.ticketDay, today && styles.ticketDayToday]}>{past ? '✓︎' : day}</Text>
                <Text style={[styles.ticketCoins, past && styles.ticketCoinsPast, today && styles.ticketCoinsToday]}>{coins}</Text>
              </View>
            );
            return today ? (
              <Animated.View key={day} style={[styles.slot, { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
                {ticket}
              </Animated.View>
            ) : (
              <View key={day} style={styles.slot}>
                {ticket}
              </View>
            );
          })}
        </View>

        <CoinsEarned amount={total} style={styles.coins} />
        {(gift.welcomeBack > 0 || gift.charm) && (
          <View style={styles.extras}>
            {gift.welcomeBack > 0 && (
              <View style={styles.extra}>
                <CoinGlyph size={11} />
                <Text style={styles.extraText}>{`${gift.welcomeBack} OF IT FOR COMING BACK`}</Text>
              </View>
            )}
            {gift.charm && (
              <View style={styles.extra}>
                <Text style={styles.extraText}>{`+ A LUCKY CHARM · ${LUCKY_CHARM_CHARGES} SOLVES PAY DOUBLE`}</Text>
              </View>
            )}
          </View>
        )}
        <PressableScale accessibilityRole="button" accessibilityLabel={`Collect ${total} coins`} onPress={onCollect} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Collect</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
  card: {
    width: '88%',
    maxWidth: 380,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  kicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 2, color: theme.colors.secondary },
  title: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: { marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  week: { flexDirection: 'row', width: '100%', marginTop: theme.spacing.lg, paddingTop: 6 },
  slot: { flex: 1, paddingHorizontal: 2 },
  ticket: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceHi,
  },
  ticketPast: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.surfaceAlt },
  ticketGilt: { borderColor: theme.colors.goldRim, backgroundColor: theme.colors.creamPlate },
  ticketToday: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  ticketDay: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 0.5, color: theme.colors.textTertiary },
  ticketDayToday: { color: theme.colors.surfaceHi, opacity: 0.8 },
  ticketCoins: { marginTop: 2, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  ticketCoinsPast: { color: theme.colors.textTertiary },
  ticketCoinsToday: { color: theme.colors.surfaceHi },
  coins: { marginTop: theme.spacing.lg },
  extras: { marginTop: theme.spacing.sm, alignItems: 'center', gap: 4 },
  extra: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  extraText: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.accentText },
  button: { marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.md, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  pressed: { opacity: 0.85 },
  buttonText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.semibold },
}));
