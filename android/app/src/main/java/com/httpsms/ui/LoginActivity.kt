package com.httpsms.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

// LoginActivity is kept as a stub — app goes straight to MainActivity
class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
