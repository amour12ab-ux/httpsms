package com.httpsms.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.RadioButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.firebase.messaging.FirebaseMessaging
import com.httpsms.R
import com.httpsms.data.PhoneProfile
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivitySettingsBinding
import com.httpsms.network.ApiKeyItem
import com.httpsms.network.ApiKeyRequest
import com.httpsms.network.RegisterRequest
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private val profiles  = mutableListOf<PhoneProfile>()
    private val keyItems  = mutableListOf<ApiKeyItem>()
    private lateinit var profilesAdapter: PhoneProfileAdapter
    private lateinit var keysAdapter: ApiKeyAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)
        binding.toolbar.setNavigationOnClickListener { finish() }

        // Pre-fill server settings
        binding.etServerUrl.setText(Prefs.getServerUrl(this))
        binding.etApiKey.setText(Prefs.getApiKey(this))

        // Phone profiles RecyclerView
        profiles.addAll(Prefs.getProfiles(this))
        val activeId = Prefs.getActiveProfileId(this)
        profilesAdapter = PhoneProfileAdapter(
            items    = profiles,
            activeId = activeId,
            onSelect = { profile -> setActiveProfile(profile) },
            onDelete = { profile -> confirmDeleteProfile(profile) }
        )
        binding.rvPhoneProfiles.apply {
            layoutManager = LinearLayoutManager(this@SettingsActivity)
            adapter = profilesAdapter
        }
        refreshProfilesEmpty()

        // API keys RecyclerView
        keysAdapter = ApiKeyAdapter(keyItems, onRevoke = { confirmRevoke(it) })
        binding.rvApiKeys.apply {
            layoutManager = LinearLayoutManager(this@SettingsActivity)
            adapter = keysAdapter
        }

        binding.btnTestConnection.setOnClickListener { testConnection() }
        binding.btnAddProfile.setOnClickListener    { addProfile() }
        binding.btnGenerateKey.setOnClickListener   { generateKey() }
        binding.btnCopyKey.setOnClickListener       { copyNewKey() }
        binding.btnSaveSettings.setOnClickListener  { saveSettings() }

        loadApiKeys()
    }

    // ── Server ────────────────────────────────────────────────────────────────

    private fun testConnection() {
        val url    = binding.etServerUrl.text.toString().trim()
        val apiKey = binding.etApiKey.text.toString().trim()
        if (url.isBlank()) { showConnectionResult("Enter a server URL first", false); return }

        binding.btnTestConnection.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val status = RetrofitClient.create(url, apiKey).getStatus()
                withContext(Dispatchers.Main) {
                    showConnectionResult("Connected ✓  v${status.version} · ${status.devices} device(s)", true)
                    binding.btnTestConnection.isEnabled = true
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    showConnectionResult("Failed: ${e.message}", false)
                    binding.btnTestConnection.isEnabled = true
                }
            }
        }
    }

    // ── Phone profiles ────────────────────────────────────────────────────────

    private fun addProfile() {
        val label  = binding.etProfileLabel.text.toString().trim()
        val phone  = binding.etProfilePhone.text.toString().trim()
        val url    = binding.etServerUrl.text.toString().trim()
        val apiKey = binding.etApiKey.text.toString().trim()

        if (label.isBlank() || phone.isBlank()) {
            Toast.makeText(this, "Label and phone number are required", Toast.LENGTH_SHORT).show()
            return
        }
        if (url.isBlank()) {
            Toast.makeText(this, "Save Server URL first", Toast.LENGTH_SHORT).show(); return
        }

        val profile = PhoneProfile(label = label, phoneNumber = phone)
        binding.btnAddProfile.isEnabled = false

        FirebaseMessaging.getInstance().token.addOnSuccessListener { fcmToken ->
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    RetrofitClient.create(url, apiKey).registerDevice(
                        RegisterRequest(profile.deviceId, fcmToken, "${Build.MODEL} – $label")
                    )
                    withContext(Dispatchers.Main) {
                        profiles.add(profile)
                        Prefs.saveProfiles(this@SettingsActivity, profiles)
                        if (profiles.size == 1) {
                            Prefs.setActiveProfileId(this@SettingsActivity, profile.id)
                            profilesAdapter.activeId = profile.id
                        }
                        profilesAdapter.notifyItemInserted(profiles.size - 1)
                        refreshProfilesEmpty()
                        binding.etProfileLabel.text?.clear()
                        binding.etProfilePhone.text?.clear()
                        binding.btnAddProfile.isEnabled = true
                        Toast.makeText(this@SettingsActivity, "\"$label\" registered", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(this@SettingsActivity, "Registration failed: ${e.message}", Toast.LENGTH_LONG).show()
                        binding.btnAddProfile.isEnabled = true
                    }
                }
            }
        }.addOnFailureListener {
            binding.btnAddProfile.isEnabled = true
            Toast.makeText(this, "FCM token error: ${it.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun setActiveProfile(profile: PhoneProfile) {
        Prefs.setActiveProfileId(this, profile.id)
        profilesAdapter.activeId = profile.id
        profilesAdapter.notifyDataSetChanged()
        Toast.makeText(this, "Active: ${profile.label} (${profile.phoneNumber})", Toast.LENGTH_SHORT).show()
    }

    private fun confirmDeleteProfile(profile: PhoneProfile) {
        AlertDialog.Builder(this)
            .setTitle("Remove number")
            .setMessage("Remove \"${profile.label}\" (${profile.phoneNumber})?")
            .setPositiveButton("Remove") { _, _ ->
                profiles.remove(profile)
                Prefs.saveProfiles(this, profiles)
                if (Prefs.getActiveProfileId(this) == profile.id) {
                    val next = profiles.firstOrNull()
                    Prefs.setActiveProfileId(this, next?.id ?: "")
                    profilesAdapter.activeId = next?.id ?: ""
                }
                profilesAdapter.notifyDataSetChanged()
                refreshProfilesEmpty()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun refreshProfilesEmpty() {
        binding.tvNoProfiles.visibility = if (profiles.isEmpty()) View.VISIBLE else View.GONE
    }

    // ── API Keys ──────────────────────────────────────────────────────────────

    private fun generateKey() {
        val url    = binding.etServerUrl.text.toString().trim()
        val apiKey = binding.etApiKey.text.toString().trim()
        val label  = binding.etKeyLabel.text.toString().trim().ifBlank { "My Key" }

        if (url.isBlank() || apiKey.isBlank()) {
            Toast.makeText(this, "Enter Server URL and API Key first", Toast.LENGTH_SHORT).show(); return
        }
        binding.btnGenerateKey.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val result = RetrofitClient.create(url, apiKey).createApiKey(ApiKeyRequest(label))
                withContext(Dispatchers.Main) {
                    binding.tvNewKey.text = result.key
                    binding.cardNewKey.visibility = View.VISIBLE
                    binding.btnGenerateKey.isEnabled = true
                    loadApiKeys()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@SettingsActivity, "Failed: ${e.message}", Toast.LENGTH_LONG).show()
                    binding.btnGenerateKey.isEnabled = true
                }
            }
        }
    }

    private fun copyNewKey() {
        val key = binding.tvNewKey.text.toString()
        if (key.isBlank()) return
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("API Key", key))
        Toast.makeText(this, "Copied to clipboard", Toast.LENGTH_SHORT).show()
    }

    private fun loadApiKeys() {
        val url    = Prefs.getServerUrl(this).ifBlank { binding.etServerUrl.text.toString().trim() }
        val apiKey = Prefs.getApiKey(this).ifBlank { binding.etApiKey.text.toString().trim() }
        if (url.isBlank() || apiKey.isBlank()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val result = RetrofitClient.create(url, apiKey).listApiKeys()
                withContext(Dispatchers.Main) {
                    keyItems.clear(); keyItems.addAll(result.keys)
                    keysAdapter.notifyDataSetChanged()
                    binding.tvNoKeys.visibility = if (result.keys.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (_: Exception) {}
        }
    }

    private fun confirmRevoke(item: ApiKeyItem) {
        AlertDialog.Builder(this)
            .setTitle("Revoke key")
            .setMessage("Revoke \"${item.label}\"? Systems using this key will lose access.")
            .setPositiveButton("Revoke") { _, _ ->
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        RetrofitClient.create(Prefs.getServerUrl(this@SettingsActivity),
                            Prefs.getApiKey(this@SettingsActivity)).deleteApiKey(item.id)
                        withContext(Dispatchers.Main) { loadApiKeys() }
                    } catch (e: Exception) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@SettingsActivity, "Failed: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    private fun saveSettings() {
        val url    = binding.etServerUrl.text.toString().trim()
        val apiKey = binding.etApiKey.text.toString().trim()
        if (url.isBlank()) {
            Toast.makeText(this, "Server URL is required", Toast.LENGTH_SHORT).show(); return
        }
        Prefs.saveServerSettings(this, url, apiKey)
        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        finish()
    }

    private fun showConnectionResult(msg: String, success: Boolean) {
        binding.tvConnectionResult.text = msg
        binding.tvConnectionResult.setTextColor(getColor(if (success) R.color.colorSuccess else R.color.colorError))
        binding.tvConnectionResult.visibility = View.VISIBLE
    }
}

// ─── Phone Profile Adapter ────────────────────────────────────────────────────

class PhoneProfileAdapter(
    private val items: List<PhoneProfile>,
    var activeId: String,
    private val onSelect: (PhoneProfile) -> Unit,
    private val onDelete: (PhoneProfile) -> Unit
) : RecyclerView.Adapter<PhoneProfileAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val rbActive: RadioButton  = view.findViewById(R.id.rbActive)
        val tvLabel: TextView      = view.findViewById(R.id.tvProfileLabel)
        val tvPhone: TextView      = view.findViewById(R.id.tvProfilePhone)
        val tvDeviceId: TextView   = view.findViewById(R.id.tvProfileDeviceId)
        val btnDelete: MaterialButton = view.findViewById(R.id.btnDeleteProfile)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = VH(
        LayoutInflater.from(parent.context).inflate(R.layout.item_phone_profile, parent, false)
    )

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = items[position]
        holder.tvLabel.text    = p.label
        holder.tvPhone.text    = p.phoneNumber
        holder.tvDeviceId.text = "Device ID: ${p.deviceId.take(8)}…"
        holder.rbActive.isChecked = p.id == activeId
        holder.itemView.setOnClickListener { onSelect(p) }
        holder.rbActive.setOnClickListener { onSelect(p) }
        holder.btnDelete.setOnClickListener { onDelete(p) }
    }

    override fun getItemCount() = items.size
}

// ─── API Key Adapter ──────────────────────────────────────────────────────────

class ApiKeyAdapter(
    private val items: List<ApiKeyItem>,
    private val onRevoke: (ApiKeyItem) -> Unit
) : RecyclerView.Adapter<ApiKeyAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvLabel: TextView    = view.findViewById(R.id.tvKeyLabel)
        val tvPreview: TextView  = view.findViewById(R.id.tvKeyPreview)
        val tvDate: TextView     = view.findViewById(R.id.tvKeyDate)
        val btnRevoke: MaterialButton = view.findViewById(R.id.btnDeleteKey)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = VH(
        LayoutInflater.from(parent.context).inflate(R.layout.item_api_key, parent, false)
    )

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvLabel.text   = item.label
        holder.tvPreview.text = item.keyPreview
        holder.tvDate.text    = "Created ${item.createdAt.take(10)}"
        holder.btnRevoke.setOnClickListener { onRevoke(item) }
    }

    override fun getItemCount() = items.size
}
