package com.gravitygame.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import com.gravitygame.MainActivity
import com.gravitygame.R
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/**
 * Today's Daily on the home screen - the Android twin of
 * ios/TesseraWidget/TesseraWidget.swift. The puzzle comes from the bundled
 * `daily-schedule.json` (tools/makeWidgetSchedule.ts); the player's state
 * from what the app last wrote (TesseraWidgetModule).
 */
class TesseraWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { manager.updateAppWidget(it, views(context)) }
  }

  companion object {
    const val PREFS = "tessera-widget"
    const val STATE_KEY = "state"
    private val EPOCH: LocalDate = LocalDate.of(2026, 1, 1)
    private var schedule: JSONObject? = null

    /** Redraws every placed widget - after the app writes new state. */
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TesseraWidgetProvider::class.java))
      ids.forEach { manager.updateAppWidget(it, views(context)) }
    }

    private fun schedule(context: Context): JSONObject? {
      schedule?.let { return it }
      return try {
        val text = context.assets.open("daily-schedule.json").bufferedReader().use { it.readText() }
        JSONObject(text).also { schedule = it }
      } catch (_: Exception) {
        null
      }
    }

    private fun views(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.tessera_widget)
      val today = LocalDate.now(ZoneOffset.UTC)
      views.setTextViewText(R.id.number, "No. ${ChronoUnit.DAYS.between(EPOCH, today) + 1}")

      // The day's puzzle.
      var name = "Open Tessera"
      var game = "A new puzzle"
      var dot = ContextCompat.getColor(context, R.color.widget_terracotta)
      schedule(context)?.let { s ->
        val index = ChronoUnit.DAYS.between(LocalDate.parse(s.getString("start")), today).toInt()
        val days = s.getJSONArray("days")
        if (index in 0 until days.length()) {
          val day = days.getJSONObject(index)
          name = day.getString("n")
          game = day.getString("g")
          dot = try { Color.parseColor(day.getString("c")) } catch (_: Exception) { dot }
        }
      }
      views.setTextViewText(R.id.name, name)
      views.setTextViewText(R.id.game, game)
      views.setInt(R.id.dot, "setColorFilter", dot)

      // The player's own state: today's done, and the streak.
      val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(STATE_KEY, null)
      var solved = false
      var streak = 0
      var knows = false
      if (raw != null) {
        try {
          val state = JSONObject(raw)
          knows = true
          val solvedKey = if (state.isNull("solvedKey")) null else state.getString("solvedKey")
          val key = today.toString()
          val yesterday = today.minusDays(1).toString()
          solved = solvedKey == key
          streak = if (solvedKey == key || solvedKey == yesterday) state.getInt("streak") else 0
        } catch (_: Exception) {
          knows = false
        }
      }
      val marks = intArrayOf(R.id.mark0, R.id.mark1, R.id.mark2, R.id.mark3, R.id.mark4, R.id.mark5, R.id.mark6)
      marks.forEachIndexed { i, id -> views.setImageViewResource(id, if (i < minOf(streak, 7)) R.drawable.widget_mark_lit else R.drawable.widget_mark) }
      val (status, color) = when {
        solved -> (if (streak > 1) "Solved · $streak-day streak" else "Solved today") to R.color.widget_solved
        streak > 0 -> "Keep your $streak-day streak" to R.color.widget_terracotta
        knows -> "Start a streak today" to R.color.widget_quiet
        else -> "Tap to play" to R.color.widget_quiet
      }
      views.setTextViewText(R.id.status, status)
      views.setTextColor(R.id.status, ContextCompat.getColor(context, color))

      // A tap opens today's Daily.
      val open = Intent(Intent.ACTION_VIEW, Uri.parse("tessera://daily"), context, MainActivity::class.java)
      val pending = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      views.setOnClickPendingIntent(R.id.widget_root, pending)
      return views
    }
  }
}
