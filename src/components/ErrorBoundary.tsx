import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { theme } from '../theme';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * The last line of defence: without this, any uncaught render error
 * anywhere in the tree white-screens the whole app with no way back short
 * of a force-quit. Deliberately kept as simple as possible - no entrance
 * animation, no dependency on any provider/context, nothing beyond plain
 * RN primitives and the static `theme` constants - since this is exactly
 * the code path that has to still work when something else has already
 * gone wrong.
 *
 * "Try again" resets this boundary's own state and re-renders its
 * children fresh - it fixes a transient error (bad props from a one-off
 * fluke), not a deterministic one (the same bug will simply throw again),
 * but that is a real and common class of crash, and there is no native
 * "reload the JS bundle" primitive available without a new dependency
 * this app hasn't otherwise needed - out of scope for this fallback.
 *
 * Logs nowhere and reports nowhere, by design - this app has no
 * telemetry of any kind, and that stays true here too.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>Sorry about that - your progress is saved. Give it another try.</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={this.reset}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </PressableScale>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});
