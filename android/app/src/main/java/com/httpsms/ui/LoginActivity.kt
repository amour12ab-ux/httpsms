package com.httpsms.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

// LoginActivity is no longer used — redirects straight to MainActivity.
// Kept to avoid manifest issues during transition.
class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
