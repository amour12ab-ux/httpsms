package com.httpsms.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.httpsms.R
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivityMainBinding
import com.httpsms.ui.MessageLogActivity
import com.httpsms.network.RegisterRequest
import com.httpsms.network.RetrofitClient
import com.httpsms.services.GatewayService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) startGateway()
        else Toast.makeText(this, "SMS permissions are required", Toast.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Pre-fill saved settings
        binding.etServerUrl.setText(Prefs.getServerUrl(this))
        binding.etApiKey.setText(Prefs.getApiKey(this))
        binding.etDeviceId.setText(Prefs.getDeviceId(this).ifBlank { UUID.randomUUID().toString() })

        binding.btnSave.setOnClickListener { saveAndRegister() }
        binding.btnViewLog.setOnClickListener {
            startActivity(Intent(this, MessageLogActivity::class.java))
        }

        if (Prefs.isConfigured(this)) {
            updateStatus("Configured — gateway active")
            requestPermissionsAndStart()
        }
    }

    private fun saveAndRegister() {
        val serverUrl = binding.etServerUrl.text.toString().trim()
        val apiKey    = binding.etApiKey.text.toString().trim()
        val deviceId  = binding.etDeviceId.text.toString().trim()

        if (serverUrl.isBlank() || apiKey.isBlank() || deviceId.isBlank()) {
            Toast.makeText(this, "All fields are required", Toast.LENGTH_SHORT).show()
            return
        }

        Prefs.save(this, serverUrl, apiKey, deviceId)
        updateStatus("Registering device…")

        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    RetrofitClient.create(serverUrl).registerDevice(
                        RegisterRequest(deviceId, token, Build.MODEL)
                    )
                    withContext(Dispatchers.Main) {
                        updateStatus("Registered — gateway active")
                        requestPermissionsAndStart()
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        updateStatus("Registration failed: ${e.message}")
                    }
                }
            }
        }.addOnFailureListener {
            updateStatus("Could not get FCM token: ${it.message}")
        }
    }

    private fun requestPermissionsAndStart() {
        val needed = mutableListOf(Manifest.permission.SEND_SMS, Manifest.permission.RECEIVE_SMS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            needed.add(Manifest.permission.POST_NOTIFICATIONS)

        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) startGateway() else permissionLauncher.launch(missing.toTypedArray())
    }

    private fun startGateway() {
        ContextCompat.startForegroundService(this, Intent(this, GatewayService::class.java))
        updateStatus("Gateway running")
    }

    private fun updateStatus(msg: String) {
        binding.tvStatus.text = msg
    }
}
