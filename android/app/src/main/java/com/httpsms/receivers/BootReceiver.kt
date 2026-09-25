package com.httpsms.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import com.httpsms.data.Prefs
import com.httpsms.services.GatewayService

/** Restarts the GatewayService after device reboot. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && Prefs.isConfigured(context)) {
            ContextCompat.startForegroundService(context, Intent(context, GatewayService::class.java))
        }
    }
}
