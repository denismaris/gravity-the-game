import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether VoiceOver / TalkBack is running - for a board drawn on a canvas
 * to lay real accessibility elements over itself only when someone is
 * listening, and stay one plain touch surface otherwise.
 */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(value => {
      if (mounted) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return on;
}
