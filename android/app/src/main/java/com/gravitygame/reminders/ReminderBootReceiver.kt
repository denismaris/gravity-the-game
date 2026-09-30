package com.gravitygame.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** A reboot clears every alarm - arm the saved plan again. */
class ReminderBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    ReminderScheduler.arm(context, ReminderScheduler.load(context))
  }
}
