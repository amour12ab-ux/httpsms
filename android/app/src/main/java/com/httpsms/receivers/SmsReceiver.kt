package com.httpsms.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.httpsms.data.Prefs
import com.httpsms.network.IncomingRequest
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private const val TAG = "SmsReceiver"

/**
 * Intercepts incoming SMS messages and forwards them to the server.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        // Group multipart SMS by originating address
        val grouped = messages.groupBy { it.originatingAddress }

        grouped.forEach { (sender, parts) ->
            val body = parts.joinToString("") { it.messageBody }
            Log.d(TAG, "Incoming SMS from $sender: $body")
            forwardToServer(context, sender ?: "unknown", body)
        }
    }

    private fun forwardToServer(context: Context, sender: String, body: String) {
        val serverUrl = Prefs.getServerUrl(context)
        val deviceId  = Prefs.getDeviceId(context)
        if (serverUrl.isBlank() || deviceId.isBlank()) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                RetrofitClient.create(serverUrl)
                    .sendIncoming(IncomingRequest(sender, body, deviceId))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to forward incoming SMS", e)
            }
        }
    }
}
