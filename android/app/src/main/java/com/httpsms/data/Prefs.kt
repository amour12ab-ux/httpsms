package com.httpsms.data

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

object Prefs {

    private const val NAME               = "httpsms_prefs"
    private const val KEY_SERVER_URL     = "server_url"
    private const val KEY_API_KEY        = "api_key"
    private const val KEY_ACTIVE_PROFILE = "active_profile_id"
    private const val KEY_PROFILES       = "phone_profiles"
    private const val KEY_USER_UID       = "user_uid"
    private const val KEY_USER_NAME      = "user_name"
    private const val KEY_USER_EMAIL     = "user_email"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    // ── Server settings ───────────────────────────────────────────────────────
    fun getServerUrl(ctx: Context) = prefs(ctx).getString(KEY_SERVER_URL, "") ?: ""
    fun getApiKey(ctx: Context)    = prefs(ctx).getString(KEY_API_KEY, "") ?: ""

    fun saveServerSettings(ctx: Context, serverUrl: String, apiKey: String) {
        prefs(ctx).edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .putString(KEY_API_KEY, apiKey)
            .apply()
    }

    // ── Phone profiles ────────────────────────────────────────────────────────
    fun getProfiles(ctx: Context): List<PhoneProfile> {
        val json = prefs(ctx).getString(KEY_PROFILES, "[]") ?: "[]"
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                PhoneProfile(
                    id          = o.getString("id"),
                    label       = o.getString("label"),
                    phoneNumber = o.getString("phoneNumber"),
                    deviceId    = o.getString("deviceId")
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    fun saveProfiles(ctx: Context, profiles: List<PhoneProfile>) {
        val arr = JSONArray()
        profiles.forEach { p ->
            arr.put(JSONObject().apply {
                put("id", p.id)
                put("label", p.label)
                put("phoneNumber", p.phoneNumber)
                put("deviceId", p.deviceId)
            })
        }
        prefs(ctx).edit().putString(KEY_PROFILES, arr.toString()).apply()
    }

    fun getActiveProfileId(ctx: Context) = prefs(ctx).getString(KEY_ACTIVE_PROFILE, "") ?: ""

    fun setActiveProfileId(ctx: Context, id: String) {
        prefs(ctx).edit().putString(KEY_ACTIVE_PROFILE, id).apply()
    }

    fun getActiveProfile(ctx: Context): PhoneProfile? {
        val activeId = getActiveProfileId(ctx)
        val profiles = getProfiles(ctx)
        return profiles.find { it.id == activeId } ?: profiles.firstOrNull()
    }

    // Convenience — active profile's deviceId (used by services)
    fun getDeviceId(ctx: Context) = getActiveProfile(ctx)?.deviceId ?: ""
    fun getPhoneNumber(ctx: Context) = getActiveProfile(ctx)?.phoneNumber ?: ""

    // ── User auth ─────────────────────────────────────────────────────────────
    fun getUserUid(ctx: Context)   = prefs(ctx).getString(KEY_USER_UID, "") ?: ""
    fun getUserName(ctx: Context)  = prefs(ctx).getString(KEY_USER_NAME, "") ?: ""
    fun getUserEmail(ctx: Context) = prefs(ctx).getString(KEY_USER_EMAIL, "") ?: ""

    fun saveUser(ctx: Context, uid: String, name: String, email: String) {
        prefs(ctx).edit()
            .putString(KEY_USER_UID, uid)
            .putString(KEY_USER_NAME, name)
            .putString(KEY_USER_EMAIL, email)
            .apply()
    }

    fun clearUser(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_USER_UID).remove(KEY_USER_NAME).remove(KEY_USER_EMAIL)
            .apply()
    }

    fun isConfigured(ctx: Context) =
        getServerUrl(ctx).isNotBlank() && getApiKey(ctx).isNotBlank() && getProfiles(ctx).isNotEmpty()
}
