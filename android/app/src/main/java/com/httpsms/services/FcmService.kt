package com.httpsms.services

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.httpsms.data.Prefs
import com.httpsms.network.RegisterRequest
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private const val TAG = "FcmService"

class FcmService : FirebaseMessagingService() {

    /**
     * Called when a new FCM message arrives.
     * Payload keys: messageId, to, body
     */
    override fun onMessageReceived(message: RemoteMessage) {
        val data      = message.data
        val messageId = data["messageId"] ?: return
        val recipient = data["to"]        ?: return
        val body      = data["body"]      ?: return

        Log.d(TAG, "FCM received — messageId=$messageId to=$recipient")
        SmsSender.send(applicationContext, messageId, recipient, body)
    }

    /**
     * Called when the FCM token is refreshed.
     * Re-register with the server so it always has the latest token.
     */
    override fun onNewToken(token: String) {
        Log.d(TAG, "FCM token refreshed: $token")
        val ctx       = applicationContext
        val serverUrl = Prefs.getServerUrl(ctx)
        val deviceId  = Prefs.getDeviceId(ctx)
        if (serverUrl.isBlank() || deviceId.isBlank()) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apiKey = Prefs.getApiKey(ctx)
                RetrofitClient.create(serverUrl, apiKey).registerDevice(
                    RegisterRequest(deviceId, token, android.os.Build.MODEL)
                )
            } catch (e: Exception) {
                Log.e(TAG, "Token re-registration failed", e)
            }
        }
    }
}
