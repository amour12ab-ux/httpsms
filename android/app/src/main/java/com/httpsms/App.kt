package com.httpsms

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class App : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "SMS Gateway Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Keeps the SMS gateway running in the background" }

        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "sms_gateway_channel"
    }
}
