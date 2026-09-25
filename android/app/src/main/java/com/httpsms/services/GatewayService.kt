package com.httpsms.services

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.httpsms.App
import com.httpsms.R
import com.httpsms.ui.MainActivity

/**
 * Persistent foreground service that keeps the app alive so FCM messages
 * and SMS broadcasts are always received, even when the UI is closed.
 */
class GatewayService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY   // restart automatically if killed
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val tapIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, App.CHANNEL_ID)
            .setContentTitle("SMS Gateway Active")
            .setContentText("Listening for messages…")
            .setSmallIcon(R.drawable.ic_sms)
            .setContentIntent(tapIntent)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val NOTIFICATION_ID = 1
    }
}
