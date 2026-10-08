package com.httpsms.services

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.telephony.SmsManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.httpsms.data.Prefs
import com.httpsms.network.CallbackRequest
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private const val TAG = "SmsSender"

object SmsSender {

    /**
     * Sends an SMS and posts the delivery result back to the server.
     * Uses unique action strings per message to avoid broadcast collisions.
     */
    fun send(context: Context, messageId: String, recipient: String, body: String) {
        val sentAction      = "SMS_SENT_$messageId"
        val deliveredAction = "SMS_DELIVERED_$messageId"

        val sentPI = PendingIntent.getBroadcast(
            context, 0, Intent(sentAction),
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        val deliveredPI = PendingIntent.getBroadcast(
            context, 0, Intent(deliveredAction),
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        // Sent receiver
        val sentReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val status = if (resultCode == android.app.Activity.RESULT_OK) "delivered" else "failed"
                Log.d(TAG, "SMS sent result for $messageId: $status (code=$resultCode)")
                ctx.unregisterReceiver(this)
                // If not RESULT_OK, report failure immediately (no need to wait for delivery)
                if (resultCode != android.app.Activity.RESULT_OK) {
                    postCallback(ctx, messageId, "failed")
                }
            }
        }

        // Delivered receiver
        val deliveredReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val status = if (resultCode == android.app.Activity.RESULT_OK) "delivered" else "failed"
                Log.d(TAG, "SMS delivered result for $messageId: $status")
                ctx.unregisterReceiver(this)
                postCallback(ctx, messageId, status)
            }
        }

        ContextCompat.registerReceiver(context, sentReceiver, IntentFilter(sentAction), ContextCompat.RECEIVER_NOT_EXPORTED)
        ContextCompat.registerReceiver(context, deliveredReceiver, IntentFilter(deliveredAction), ContextCompat.RECEIVER_NOT_EXPORTED)

        try {
            val smsManager = context.getSystemService(SmsManager::class.java)
            val parts = smsManager.divideMessage(body)
            if (parts.size == 1) {
                smsManager.sendTextMessage(recipient, null, body, sentPI, deliveredPI)
            } else {
                // Multipart — only track last part for delivery
                val sentList = ArrayList<PendingIntent>(parts.size).apply {
                    repeat(parts.size - 1) { add(sentPI) }
                    add(sentPI)
                }
                val deliveredList = ArrayList<PendingIntent>(parts.size).apply {
                    repeat(parts.size - 1) { add(deliveredPI) }
                    add(deliveredPI)
                }
                smsManager.sendMultipartTextMessage(recipient, null, parts, sentList, deliveredList)
            }
            Log.d(TAG, "SMS dispatched to $recipient (messageId=$messageId)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send SMS", e)
            context.unregisterReceiver(sentReceiver)
            context.unregisterReceiver(deliveredReceiver)
            postCallback(context, messageId, "failed")
        }
    }

    private fun postCallback(context: Context, messageId: String, status: String) {
        val serverUrl = Prefs.getServerUrl(context)
        if (serverUrl.isBlank()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                RetrofitClient.create(serverUrl).sendCallback(CallbackRequest(messageId, status))
            } catch (e: Exception) {
                Log.e(TAG, "Callback failed for $messageId", e)
            }
        }
    }
}
