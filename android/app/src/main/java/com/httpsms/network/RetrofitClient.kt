package com.httpsms.network

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {

    /**
     * Creates an ApiService that authenticates every request.
     * Uses Firebase ID token (Google Sign-In) when a user is signed in,
     * falls back to the static API key otherwise.
     */
    fun create(baseUrl: String, apiKey: String = ""): ApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val authInterceptor = Interceptor { chain ->
            val builder = chain.request().newBuilder()

            if (apiKey.isNotBlank()) {
                // API key takes priority — always works even without Firebase
                builder.header("x-api-key", apiKey)
            } else {
                // Fall back to Firebase Bearer token
                val firebaseUser = FirebaseAuth.getInstance().currentUser
                if (firebaseUser != null) {
                    val token = runBlocking {
                        try { firebaseUser.getIdToken(false).await().token } catch (e: Exception) { null }
                    }
                    if (token != null) builder.header("Authorization", "Bearer $token")
                }
            }

            chain.proceed(builder.build())
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
