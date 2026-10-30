package com.httpsms

import android.app.Application

class App : Application() {
    companion object {
        const val CHANNEL_ID = "sms_gateway_channel"
    }
}
