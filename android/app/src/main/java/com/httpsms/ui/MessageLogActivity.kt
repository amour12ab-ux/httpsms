package com.httpsms.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout
import com.httpsms.R
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivityMessageLogBinding
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MessageItem(
    val id: String,
    val contact: String,
    val body: String,
    val status: String,
    val direction: String,   // "out" | "in"
    val timestamp: String
)

class MessageLogActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMessageLogBinding
    private val items = mutableListOf<MessageItem>()
    private lateinit var adapter: MessageAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMessageLogBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        binding.toolbar.setNavigationOnClickListener { finish() }

        adapter = MessageAdapter(items)
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MessageLogActivity)
            adapter = this@MessageLogActivity.adapter
        }

        // Add tabs
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText("Outbound"))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText("Inbound"))

        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                if (tab.position == 0) loadOutbound() else loadInbound()
            }
            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {
                if (tab.position == 0) loadOutbound() else loadInbound()
            }
        })

        loadOutbound()
    }

    private fun loadOutbound() {
        val serverUrl = Prefs.getServerUrl(this)
        val apiKey    = Prefs.getApiKey(this)
        val deviceId  = Prefs.getDeviceId(this)
        if (serverUrl.isBlank()) return

        showLoading(true)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.create(serverUrl, apiKey).getMessages(deviceId)
                val mapped = response.messages.map {
                    MessageItem(
                        id        = it.id,
                        contact   = it.recipient,
                        body      = it.body,
                        status    = it.status,
                        direction = "out",
                        timestamp = it.createdAt
                    )
                }
                withContext(Dispatchers.Main) { showItems(mapped) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { showError("Failed to load: ${e.message}") }
            }
        }
    }

    private fun loadInbound() {
        val serverUrl = Prefs.getServerUrl(this)
        val apiKey    = Prefs.getApiKey(this)
        val deviceId  = Prefs.getDeviceId(this)
        if (serverUrl.isBlank()) return

        showLoading(true)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.create(serverUrl, apiKey).getIncoming(deviceId)
                val mapped = response.messages.map {
                    MessageItem(
                        id        = it.id,
                        contact   = it.sender,
                        body      = it.body,
                        status    = it.webhookStatus,
                        direction = "in",
                        timestamp = it.receivedAt
                    )
                }
                withContext(Dispatchers.Main) { showItems(mapped) }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { showError("Failed to load: ${e.message}") }
            }
        }
    }

    private fun showLoading(show: Boolean) {
        binding.progressBar.visibility = if (show) View.VISIBLE else View.GONE
        binding.recyclerView.visibility = if (show) View.GONE else View.VISIBLE
        binding.tvEmpty.visibility = View.GONE
    }

    private fun showItems(data: List<MessageItem>) {
        showLoading(false)
        items.clear(); items.addAll(data)
        adapter.notifyDataSetChanged()
        binding.tvEmpty.visibility = if (data.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showError(msg: String) {
        showLoading(false)
        binding.tvEmpty.text = msg
        binding.tvEmpty.visibility = View.VISIBLE
    }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

class MessageAdapter(private val items: List<MessageItem>) :
    RecyclerView.Adapter<MessageAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvDirection: TextView = view.findViewById(R.id.tvDirection)
        val tvContact: TextView   = view.findViewById(R.id.tvContact)
        val tvStatus: TextView    = view.findViewById(R.id.tvStatus)
        val tvBody: TextView      = view.findViewById(R.id.tvBody)
        val tvTimestamp: TextView = view.findViewById(R.id.tvTimestamp)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_message, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.tvDirection.text  = if (item.direction == "out") "↑" else "↓"
        holder.tvContact.text    = item.contact
        holder.tvStatus.text     = item.status
        holder.tvBody.text       = item.body
        holder.tvTimestamp.text  = item.timestamp.take(16) // trim to YYYY-MM-DD HH:MM
    }

    override fun getItemCount() = items.size
}
