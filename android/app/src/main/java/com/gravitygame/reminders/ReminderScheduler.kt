package com.gravitygame.reminders

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/** One planned reminder, as JavaScript planned it. */
data class Reminder(val id: String, val title: String, val body: String, val at: Long)

/**
 * Arms and clears the daily reminder's alarms, and remembers the plan so
 * a reboot (which clears every alarm) can arm it again. Inexact alarms on
 * purpose: a reminder a few minutes late is fine, and exact alarms need a
 * permission the player would have to grant by hand.
 */
object ReminderScheduler {
  const val CHANNEL_ID = "daily-reminder"
  private const val PREFS = "tessera-reminders"
  private const val KEY_PLAN = "plan"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Daily puzzle", NotificationManager.IMPORTANCE_DEFAULT)
    channel.description = "A reminder when today's Daily puzzle is waiting"
    manager.createNotificationChannel(channel)
  }

  /** Replaces the whole plan: clears what was armed, arms `plan`. */
  fun replace(context: Context, plan: List<Reminder>) {
    clear(context)
    save(context, plan)
    arm(context, plan)
  }

  fun clear(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (reminder in load(context)) alarms.cancel(pendingIntent(context, reminder))
    save(context, emptyList())
  }

  /** Arms every reminder still in the future. */
  fun arm(context: Context, plan: List<Reminder>) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val now = System.currentTimeMillis()
    for (reminder in plan) {
      if (reminder.at <= now) continue
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.at, pendingIntent(context, reminder))
    }
  }

  fun load(context: Context): List<Reminder> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PLAN, null) ?: return emptyList()
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).map { i ->
        val item = array.getJSONObject(i)
        Reminder(item.getString("id"), item.getString("title"), item.getString("body"), item.getLong("at"))
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  private fun save(context: Context, plan: List<Reminder>) {
    val array = JSONArray()
    for (reminder in plan) {
      array.put(JSONObject().put("id", reminder.id).put("title", reminder.title).put("body", reminder.body).put("at", reminder.at))
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PLAN, array.toString()).apply()
  }

  private fun pendingIntent(context: Context, reminder: Reminder): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .putExtra("id", reminder.id)
      .putExtra("title", reminder.title)
      .putExtra("body", reminder.body)
    return PendingIntent.getBroadcast(
      context,
      reminder.id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
