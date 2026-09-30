package com.gravitygame.reminders

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

/**
 * The daily reminder's native half on Android - the same four calls as
 * `ios/GravityInit/TesseraReminders.m`. See `src/notifications/native.ts`.
 */
class RemindersModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "TesseraReminders"

  private val prefs get() = context.getSharedPreferences("tessera-reminders", Context.MODE_PRIVATE)

  private fun granted(): Boolean {
    val postAllowed =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    return postAllowed && NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    if (granted()) {
      promise.resolve(true)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      // Nothing to ask below Android 13: notifications are on unless the
      // player switched them off in system settings.
      promise.resolve(false)
      return
    }
    val activity = context.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    prefs.edit().putBoolean("asked", true).apply()
    activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_CODE, PermissionListener { code, _, results ->
      if (code != REQUEST_CODE) return@PermissionListener false
      promise.resolve(results.isNotEmpty() && results[0] == PackageManager.PERMISSION_GRANTED)
      true
    })
  }

  @ReactMethod
  fun permissionStatus(promise: Promise) {
    promise.resolve(
      when {
        granted() -> "granted"
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !prefs.getBoolean("asked", false) -> "undetermined"
        else -> "denied"
      },
    )
  }

  @ReactMethod
  fun schedule(items: ReadableArray, promise: Promise) {
    val plan = (0 until items.size()).mapNotNull { i ->
      val item = items.getMap(i) ?: return@mapNotNull null
      val id = item.getString("id") ?: return@mapNotNull null
      Reminder(id, item.getString("title") ?: "Tessera", item.getString("body") ?: "", item.getDouble("at").toLong())
    }
    ReminderScheduler.ensureChannel(context)
    ReminderScheduler.replace(context, plan)
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelAll(promise: Promise) {
    ReminderScheduler.clear(context)
    promise.resolve(null)
  }

  companion object {
    private const val REQUEST_CODE = 4127
  }
}
