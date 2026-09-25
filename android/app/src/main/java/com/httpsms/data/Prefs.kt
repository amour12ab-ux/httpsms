package com.httpsms.data

import android.content.Context
import android.content.SharedPreferences

/** Simple key/value store for server URL, API key, and device ID. */
object Prefs {

    private const val NAME = "httpsms_prefs"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_API_KEY    = "api_key"
    private const val KEY_DEVICE_ID  = "device_id"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun getServerUrl(ctx: Context) = prefs(ctx).getString(KEY_SERVER_URL, "") ?: ""
    fun getApiKey(ctx: Context)    = prefs(ctx).getString(KEY_API_KEY, "") ?: ""
    fun getDeviceId(ctx: Context)  = prefs(ctx).getString(KEY_DEVICE_ID, "") ?: ""

    fun save(ctx: Context, serverUrl: String, apiKey: String, deviceId: String) {
        prefs(ctx).edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .putString(KEY_API_KEY, apiKey)
            .putString(KEY_DEVICE_ID, deviceId)
            .apply()
    }

    fun isConfigured(ctx: Context) =
        getServerUrl(ctx).isNotBlank() && getApiKey(ctx).isNotBlank() && getDeviceId(ctx).isNotBlank()
}
