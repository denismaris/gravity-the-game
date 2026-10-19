import React from 'react';
import { Animated, View } from 'react-native';
import { DialogActions, dialogStyles } from './dialog';
import { useCardEntrance } from './useCardEntrance';
import { motion, theme, themedStyles } from '../theme';
import { ModalLayer } from './ModalLayer';

export interface LevelFailedCardProps {
  /** Restart the level from its beginning. */
  onRetry: () => void;
  /** Leave to the home hub. */
  onExit: () => void;
  /**
   * What ended the attempt, for a game whose ending is not Gravity's.
   * Both default to the hazard wording this card was written for, so
   * every existing caller is unchanged - Adjacent runs a board out of
   * moves rather than destroying anything, and "DESTROYED" would be
   * simply untrue there.
   */
  title?: string;
  message?: string;
}

/**
 * Overlay shown over the board the instant a hazard destroys an object
 * (`isPuzzleFailed`). Sibling to `LevelCompleteCard` - same overlay/card
 * shell and entrance animation - but there is nothing to celebrate here: no
 * stars, no move count, just what happened and the one useful next step.
 * "Home" is still reachable, but "Retry" is the primary action since that's
 * what a failed attempt almost always calls for.
 */
/** Title, message, actions. */
const ROW_COUNT = 3;

export function LevelFailedCard({
  onRetry,
  onExit,
  title = 'A piece was lost',
  message = 'It touched a hazard. Start the board again and steer round it.',
}: LevelFailedCardProps): React.JSX.Element {
  // `subdued`: the same staged arrival every other card uses, but landing
  // without overshoot and with no light sweep. A loss should feel like it
  // settled onto the screen, not like it bounced in pleased with itself.
  const { backdrop, card, cardOpacity, rowStyle } = useCardEntrance(ROW_COUNT, { subdued: true });

  return (
    <ModalLayer>
      <View style={dialogStyles.overlay} pointerEvents="box-none">
        <Animated.View style={[dialogStyles.scrim, { opacity: backdrop }]} pointerEvents="none" />
        <Animated.View
          style={[
            dialogStyles.card,
            {
              opacity: cardOpacity,
              transform: [
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) },
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <Animated.Text style={[dialogStyles.kicker, styles.kicker, rowStyle(0)]}>Not this time</Animated.Text>
          <Animated.Text style={[dialogStyles.title, styles.title, rowStyle(0)]}>{title}</Animated.Text>
          <Animated.Text style={[dialogStyles.body, rowStyle(1)]}>{message}</Animated.Text>
          <Animated.View style={[styles.actions, rowStyle(2)]}>
            <DialogActions primary={{ label: 'Try again', onPress: onRetry, accessibilityLabel: 'Retry level' }} secondary={{ label: 'Home', onPress: onExit, accessibilityLabel: 'Back to home' }} />
          </Animated.View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  kicker: { color: theme.colors.danger },
  title: { fontSize: theme.typography.sizes.title + 4 },
  actions: { alignSelf: 'stretch' },
}));
