package com.httpsms.data

import java.util.UUID

/**
 * Represents one phone number / SIM slot registered with the gateway.
 * Each profile has its own deviceId so the server treats them independently.
 */
data class PhoneProfile(
    val id: String = UUID.randomUUID().toString(),
    val label: String,           // display name, e.g. "Work SIM"
    val phoneNumber: String,     // e.g. +1234567890
    val deviceId: String = UUID.randomUUID().toString()
)
