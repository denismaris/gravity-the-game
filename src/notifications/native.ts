import { NativeModules } from 'react-native';
import { PlannedReminder } from './reminders';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface TesseraRemindersModule {
  requestPermission(): Promise<boolean>;
  permissionStatus(): Promise<PermissionStatus>;
  /** Replaces every reminder this app has scheduled with `items`. */
  schedule(items: ReadonlyArray<PlannedReminder>): Promise<void>;
  cancelAll(): Promise<void>;
}

/**
 * The native side (`ios/GravityInit/TesseraReminders.m`,
 * `android/.../reminders/`). Absent under Jest and on a build that
 * predates it - every call then resolves quietly, so no screen has to
 * care whether reminders can actually be delivered.
 */
const native: TesseraRemindersModule | undefined = NativeModules.TesseraReminders;

export const remindersAvailable = native !== undefined;

export async function requestReminderPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.requestPermission();
  } catch {
    return false;
  }
}

export async function reminderPermissionStatus(): Promise<PermissionStatus> {
  if (!native) return 'undetermined';
  try {
    return await native.permissionStatus();
  } catch {
    return 'undetermined';
  }
}

export async function scheduleReminders(items: ReadonlyArray<PlannedReminder>): Promise<void> {
  if (!native) return;
  try {
    await native.schedule(items.map(item => ({ ...item })));
  } catch {
    // Best-effort, like saving: a reminder that fails to schedule is not
    // worth interrupting play over.
  }
}

export async function cancelReminders(): Promise<void> {
  if (!native) return;
  try {
    await native.cancelAll();
  } catch {
    // see above
  }
}
