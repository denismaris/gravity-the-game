import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Animated, Easing, Text, View } from 'react-native';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { GIFT_COINS, GIFT_DAYS, GIFT_EXTRAS, Gift, LUCKY_CHARM_CHARGES } from '../progression';
import { motion, theme, themedStyles } from '../theme';
import { CoinGlyph, CoinsEarned } from './Coins';
import { MODAL_EXIT_MS, ModalLayer } from './ModalLayer';
import { DialogActions, dialogStyles } from './dialog';
import { TileGlyph } from './TileGlyph';

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
    // Every popup waits for the one before it to finish leaving (the
    // welcome walkthrough, on a first day).
    Animated.sequence([Animated.delay(MODAL_EXIT_MS), Animated.timing(enter, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(MODAL_EXIT_MS + 240), Animated.spring(lift, { toValue: 1, useNativeDriver: true, ...motion.spring.pop })]).start();
  }, [enter, lift, reduced]);

  const total = gift.coins + gift.welcomeBack;
  const last = gift.day === GIFT_DAYS;
  return (
    // In a modal layer, so it leaves with the same fade every popup does -
    // it was the one card that simply vanished.
    <ModalLayer zIndex={50}>
    <View style={dialogStyles.overlay}>
      <Animated.View style={[dialogStyles.scrim, { opacity: enter }]} />
      <Animated.View
        style={[
          dialogStyles.card,
          { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) }] },
        ]}
      >
        <Text style={dialogStyles.kicker}>{gift.welcomeBack > 0 ? 'Welcome back' : "Today's gift"}</Text>
        <Text style={dialogStyles.title}>{last ? 'The seventh day' : `Day ${gift.day} of ${GIFT_DAYS}`}</Text>
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
                {/* The day's extras, as marks under the coins. */}
                <View style={[styles.ticketExtras, past && styles.ticketExtrasPast]}>
                  {GIFT_EXTRAS[i].insights > 0 && <Icon name="spark" size={9} color={today ? theme.colors.surfaceHi : theme.colors.secondary} />}
                  {GIFT_EXTRAS[i].tiles > 0 && <TileGlyph size={8} light={today} />}
                </View>
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
        {(gift.insights > 0 || gift.tiles > 0) && (
          <View style={styles.bonusRow}>
            {gift.insights > 0 && (
              <View style={styles.bonus}>
                <Icon name="spark" size={13} color={theme.colors.secondary} />
                <Text style={styles.bonusText}>{`+${gift.insights} Insight`}</Text>
              </View>
            )}
            {gift.tiles > 0 && (
              <View style={styles.bonus}>
                <TileGlyph size={13} />
                <Text style={styles.bonusText}>{`+${gift.tiles} tiles`}</Text>
              </View>
            )}
          </View>
        )}
        {(gift.welcomeBack > 0 || gift.charm) && (
          <View style={styles.extras}>
            {gift.welcomeBack > 0 && (
              <View style={styles.extra}>
                <CoinGlyph size={11} />
                <Text style={styles.extraText}>{`${gift.welcomeBack} of it for coming back`}</Text>
              </View>
            )}
            {gift.charm && <Text style={styles.extraText}>{`And a lucky charm: your next ${LUCKY_CHARM_CHARGES} solves pay double`}</Text>}
          </View>
        )}
        <DialogActions
          primary={{
            label: 'Collect',
            onPress: onCollect,
            accessibilityLabel: `Collect ${total} coins${gift.insights ? `, ${gift.insights} Insight` : ''}${gift.tiles ? ` and ${gift.tiles} tiles` : ''}`,
          }}
        />
      </Animated.View>
    </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
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
  ticketDay: { fontSize: 11.5, color: theme.colors.textTertiary, fontWeight: theme.typography.weights.semibold },
  ticketDayToday: { color: theme.colors.surfaceHi, opacity: 0.8 },
  ticketCoins: { marginTop: 2, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  ticketCoinsPast: { color: theme.colors.textTertiary },
  ticketCoinsToday: { color: theme.colors.surfaceHi },
  coins: { marginTop: theme.spacing.lg },
  extras: { marginTop: theme.spacing.sm, alignItems: 'center', gap: 4 },
  extra: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  extraText: { fontSize: theme.typography.sizes.caption, color: theme.colors.accentText, textAlign: 'center' },
  ticketExtras: { height: 10, marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 2 },
  ticketExtrasPast: { opacity: 0.4 },
  ticketSpark: { fontSize: 9, lineHeight: 10, color: theme.colors.secondary },
  bonusRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bonusSpark: { fontSize: 13, color: theme.colors.secondary },
  bonusText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
}));
