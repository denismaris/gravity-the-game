import { NativeModules } from 'react-native';

/**
 * The home-screen widget's live half. The widget already knows each day's
 * Daily (a schedule is bundled with it, see `schedule.ts`); what it needs
 * from the app is the player's own state - is today's done, and how long
 * is the streak. Written whenever that changes; a platform without the
 * native module (or a widget that cannot read the app's storage) simply
 * shows the Daily without it.
 */
export interface WidgetState {
  readonly streak: number;
  /** The day key of the last Daily solved, or null. */
  readonly solvedKey: string | null;
}

interface TesseraWidgetModule {
  update(json: string): void;
}

const native: TesseraWidgetModule | undefined = NativeModules.TesseraWidget;

let last = '';

export function syncWidget(state: WidgetState): void {
  const json = JSON.stringify(state);
  if (json === last || !native) return;
  last = json;
  try {
    native.update(json);
  } catch {
    // A widget is a nicety; never let it break the app.
  }
}
