package com.gravitygame.reminders

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.gravitygame.R

/** An alarm went off: post the reminder it carries. */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    ReminderScheduler.ensureChannel(context)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val open = launch?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_tessera)
      .setColor(0xFF3B1F52.toInt())
      .setContentTitle(intent.getStringExtra("title") ?: "Tessera")
      .setContentText(intent.getStringExtra("body") ?: "")
      .setStyle(NotificationCompat.BigTextStyle().bigText(intent.getStringExtra("body") ?: ""))
      .setAutoCancel(true)
      .setContentIntent(open)
      .build()
    try {
      manager.notify(id.hashCode(), notification)
    } catch (e: SecurityException) {
      // The permission was withdrawn after the plan was made.
    }
  }
}
