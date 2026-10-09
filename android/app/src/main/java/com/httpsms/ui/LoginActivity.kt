package com.httpsms.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.httpsms.R
import com.httpsms.data.Prefs
import com.httpsms.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var auth: FirebaseAuth
    private var googleClient: GoogleSignInClient? = null

    companion object {
        private const val RC_SIGN_IN = 9001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Guard: catch any crash during init (e.g. missing google-services config)
        try {
            binding = ActivityLoginBinding.inflate(layoutInflater)
            setContentView(binding.root)

            auth = FirebaseAuth.getInstance()

            // If already signed in, go straight to main
            if (auth.currentUser != null) {
                goToMain(); return
            }

            // Try to set up Google Sign-In — may fail if OAuth client not configured
            try {
                val webClientId = getString(R.string.default_web_client_id)
                if (webClientId.isNotBlank() && !webClientId.contains("YOUR_WEB")) {
                    val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(webClientId)
                        .requestEmail()
                        .build()
                    googleClient = GoogleSignIn.getClient(this, gso)
                }
            } catch (e: Exception) {
                // Google Sign-In not configured — button will be hidden
            }

            if (googleClient != null) {
                binding.btnGoogleSignIn.visibility = View.VISIBLE
                binding.btnGoogleSignIn.setOnClickListener {
                    setLoading(true)
                    startActivityForResult(googleClient!!.signInIntent, RC_SIGN_IN)
                }
            } else {
                binding.btnGoogleSignIn.visibility = View.GONE
                // Skip login entirely — go straight to main
                goToMain()
            }

        } catch (e: Exception) {
            // Last resort — if everything fails, go to main anyway
            goToMain()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != RC_SIGN_IN) return

        try {
            val account: GoogleSignInAccount =
                GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException::class.java)
            firebaseAuthWithGoogle(account)
        } catch (e: ApiException) {
            setLoading(false)
            showError("Google sign-in failed: ${e.statusCode}")
        }
    }

    private fun firebaseAuthWithGoogle(account: GoogleSignInAccount) {
        val credential = GoogleAuthProvider.getCredential(account.idToken, null)
        auth.signInWithCredential(credential)
            .addOnSuccessListener { result ->
                result.user?.let { user ->
                    Prefs.saveUser(this, user.uid, user.displayName ?: "", user.email ?: "")
                }
                goToMain()
            }
            .addOnFailureListener { e ->
                setLoading(false)
                showError("Authentication failed: ${e.message}")
            }
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private fun setLoading(loading: Boolean) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnGoogleSignIn.isEnabled = !loading
        binding.tvError.visibility = View.GONE
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }
}
