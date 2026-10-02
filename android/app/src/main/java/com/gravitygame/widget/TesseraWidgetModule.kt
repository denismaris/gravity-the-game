package com.gravitygame.widget

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** The widget's bridge: the app writes the player's Daily state here
 * (src/widget/index.ts) and the widget redraws. */
class TesseraWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "TesseraWidget"

  @ReactMethod
  fun update(json: String) {
    context.getSharedPreferences(TesseraWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString(TesseraWidgetProvider.STATE_KEY, json).apply()
    TesseraWidgetProvider.refresh(context)
  }
}
