package com.httpsms.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.DividerItemDecoration
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivityMessageLogBinding
import com.httpsms.network.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MessageItem(
    val id: String,
    val recipient: String?,
    val sender: String?,
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
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        title = "Message Log"

        adapter = MessageAdapter(items)
        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@MessageLogActivity)
            addItemDecoration(DividerItemDecoration(context, DividerItemDecoration.VERTICAL))
            adapter = this@MessageLogActivity.adapter
        }

        binding.tabOutbound.setOnClickListener { loadOutbound() }
        binding.tabInbound.setOnClickListener  { loadInbound() }

        loadOutbound()
    }

    private fun loadOutbound() {
        val serverUrl = Prefs.getServerUrl(this)
        val deviceId  = Prefs.getDeviceId(this)
        if (serverUrl.isBlank()) return

        binding.progressBar.visibility = View.VISIBLE
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api      = RetrofitClient.create(serverUrl)
                val response = api.getMessages(deviceId)
                val mapped   = response.messages.map {
                    MessageItem(
                        id        = it.id,
                        recipient = it.recipient,
                        sender    = null,
                        body      = it.body,
                        status    = it.status,
                        direction = "out",
                        timestamp = it.createdAt
                    )
                }
                withContext(Dispatchers.Main) {
                    items.clear(); items.addAll(mapped)
                    adapter.notifyDataSetChanged()
                    binding.progressBar.visibility = View.GONE
                    binding.tvEmpty.visibility = if (mapped.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.progressBar.visibility = View.GONE
                    binding.tvEmpty.text = "Failed to load: ${e.message}"
                    binding.tvEmpty.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun loadInbound() {
        val serverUrl = Prefs.getServerUrl(this)
        val deviceId  = Prefs.getDeviceId(this)
        if (serverUrl.isBlank()) return

        binding.progressBar.visibility = View.VISIBLE
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api      = RetrofitClient.create(serverUrl)
                val response = api.getIncoming(deviceId)
                val mapped   = response.messages.map {
                    MessageItem(
                        id        = it.id,
                        recipient = null,
                        sender    = it.sender,
                        body      = it.body,
                        status    = it.webhookStatus,
                        direction = "in",
                        timestamp = it.receivedAt
                    )
                }
                withContext(Dispatchers.Main) {
                    items.clear(); items.addAll(mapped)
                    adapter.notifyDataSetChanged()
                    binding.progressBar.visibility = View.GONE
                    binding.tvEmpty.visibility = if (mapped.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.progressBar.visibility = View.GONE
                    binding.tvEmpty.text = "Failed to load: ${e.message}"
                    binding.tvEmpty.visibility = View.VISIBLE
                }
            }
        }
    }

    override fun onSupportNavigateUp(): Boolean { finish(); return true }
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

class MessageAdapter(private val items: List<MessageItem>) :
    RecyclerView.Adapter<MessageAdapter.VH>() {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val tvContact: TextView  = view.findViewById(android.R.id.text1)
        val tvPreview: TextView  = view.findViewById(android.R.id.text2)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_2, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        val contact = if (item.direction == "out") "→ ${item.recipient}" else "← ${item.sender}"
        holder.tvContact.text  = "$contact  [${item.status}]"
        holder.tvPreview.text  = item.body
    }

    override fun getItemCount() = items.size
}
