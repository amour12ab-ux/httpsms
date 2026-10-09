package com.httpsms.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.firebase.auth.FirebaseAuth
import com.httpsms.R
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivityMainBinding
import com.httpsms.network.RetrofitClient
import com.httpsms.services.GatewayService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) startGateway()
        else Toast.makeText(this, "SMS permissions are required", Toast.LENGTH_LONG).show()
    }

    override fun onResume() {
        super.onResume()
        // Refresh status when returning from SettingsActivity
        if (Prefs.isConfigured(this)) checkServerConfig()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        // Redirect to login if not authenticated
        try {
            if (FirebaseAuth.getInstance().currentUser == null) {
                startActivity(Intent(this, LoginActivity::class.java)); finish(); return
            }
            val userName = Prefs.getUserName(this).ifBlank { Prefs.getUserEmail(this) }
            if (userName.isNotBlank()) supportActionBar?.subtitle = userName
        } catch (_: Exception) {
            // Firebase not available — continue without auth
        }

        binding.btnCheckConfig.setOnClickListener { checkServerConfig() }
        binding.btnViewLog.setOnClickListener {
            startActivity(Intent(this, MessageLogActivity::class.java))
        }
        binding.btnGoSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        if (Prefs.isConfigured(this)) {
            val active = Prefs.getActiveProfile(this)
            setStatus("Gateway active · ${active?.phoneNumber ?: ""}", true)
            binding.statsCard.visibility = View.VISIBLE
            requestPermissionsAndStart()
            checkServerConfig()
        } else {
            setStatus("Not configured — open Settings", null)
        }
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java)); true
            }
            R.id.action_sign_out -> { signOut(); true }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun checkServerConfig() {
        val serverUrl = Prefs.getServerUrl(this)
        val apiKey    = Prefs.getApiKey(this)
        if (serverUrl.isBlank()) return

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val status = RetrofitClient.create(serverUrl, apiKey).getStatus()
                withContext(Dispatchers.Main) {
                    binding.tvStatDevices.text  = status.devices.toString()
                    binding.tvStatMessages.text = status.messages.toString()
                    binding.tvStatIncoming.text = status.incoming.toString()
                    binding.statsCard.visibility = View.VISIBLE
                    setStatus("Gateway active", true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    setStatus("Server unreachable", false)
                }
            }
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
    }

    private fun setStatus(msg: String, online: Boolean?) {
        binding.tvStatus.text = msg
        binding.statusDot.setBackgroundResource(when (online) {
            true  -> R.drawable.status_dot_green
            false -> R.drawable.status_dot_red
            null  -> R.drawable.status_dot
        })
    }

    private fun signOut() {
        FirebaseAuth.getInstance().signOut()
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).build()
        GoogleSignIn.getClient(this, gso).signOut().addOnCompleteListener {
            Prefs.clearUser(this)
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }
}
