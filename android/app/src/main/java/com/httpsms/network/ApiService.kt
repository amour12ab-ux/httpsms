package com.httpsms.network

import retrofit2.http.*

// ─── Request bodies ───────────────────────────────────────────────────────────

data class CallbackRequest(val messageId: String, val status: String)
data class IncomingRequest(val sender: String, val body: String, val deviceId: String)
data class RegisterRequest(val deviceId: String, val fcmToken: String, val name: String)

// ─── Response models ──────────────────────────────────────────────────────────

data class OutboundMessage(
    val id: String,
    val recipient: String,
    val body: String,
    val status: String,
    val createdAt: String
)

data class InboundMessage(
    val id: String,
    val sender: String,
    val body: String,
    val deviceId: String,
    val webhookStatus: String,
    val receivedAt: String
)

data class MessagesResponse(val messages: List<OutboundMessage>)
data class IncomingResponse(val messages: List<InboundMessage>)

data class StatusResponse(
    val status: String,
    val version: String,
    val devices: Int,
    val messages: Int,
    val incoming: Int
)

data class ApiKeyRequest(val label: String)
data class ApiKeyResponse(val id: String, val key: String, val label: String)
data class ApiKeyItem(val id: String, val label: String, val keyPreview: String, val createdAt: String)
data class ApiKeysListResponse(val keys: List<ApiKeyItem>)

// ─── Endpoints ────────────────────────────────────────────────────────────────

interface ApiService {

    @GET("api/v1/status")
    suspend fun getStatus(): StatusResponse

    @POST("api/v1/apikeys")
    suspend fun createApiKey(@Body body: ApiKeyRequest): ApiKeyResponse

    @GET("api/v1/apikeys")
    suspend fun listApiKeys(): ApiKeysListResponse

    @DELETE("api/v1/apikeys/{id}")
    suspend fun deleteApiKey(@Path("id") id: String)

    @POST("api/v1/callback")
    suspend fun sendCallback(@Body body: CallbackRequest)

    @POST("api/v1/incoming")
    suspend fun sendIncoming(@Body body: IncomingRequest)

    @POST("api/v1/devices/register")
    suspend fun registerDevice(@Body body: RegisterRequest)

    @GET("api/v1/messages")
    suspend fun getMessages(@Query("deviceId") deviceId: String): MessagesResponse

    @GET("api/v1/incoming")
    suspend fun getIncoming(@Query("deviceId") deviceId: String): IncomingResponse
}
