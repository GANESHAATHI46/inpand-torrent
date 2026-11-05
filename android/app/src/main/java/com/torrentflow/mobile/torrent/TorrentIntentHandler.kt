package com.torrentflow.mobile.torrent

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.net.URLDecoder

/**
 * Handles incoming Android Intents for .torrent files and magnet URIs.
 * Supports ACTION_VIEW, ACTION_SEND, and ACTION_SEND_MULTIPLE from Android Files,
 * Chrome, Telegram, WhatsApp, and third-party file managers.
 */
object TorrentIntentHandler {
    private const val TAG = "TorrentIntentHandler"

    // Pending intent for cold-start delivery to React Native
    private var pendingInitialTorrent: WritableMap? = null

    // Listener for active runtime intent delivery
    private var intentListener: ((WritableMap) -> Unit)? = null

    // Cache to debounce duplicate intent deliveries within 1500ms
    private var lastProcessedUri: String? = null
    private var lastProcessedTimestamp: Long = 0L

    fun setListener(listener: ((WritableMap) -> Unit)?) {
        intentListener = listener
        // If there's an unconsumed pending cold-start intent, dispatch it immediately
        pendingInitialTorrent?.let { map ->
            listener?.invoke(map)
            pendingInitialTorrent = null
        }
    }

    fun getInitialTorrent(): WritableMap? {
        val map = pendingInitialTorrent
        pendingInitialTorrent = null
        return map
    }

    fun handleIntent(intent: Intent?, context: Context): Boolean {
        if (intent == null) return false

        val action = intent.action ?: return false
        Log.i(TAG, "Incoming intent action: $action, type: ${intent.type}, data: ${intent.data}")

        return when (action) {
            Intent.ACTION_VIEW -> handleViewIntent(intent, context)
            Intent.ACTION_SEND -> handleSendIntent(intent, context)
            Intent.ACTION_SEND_MULTIPLE -> handleSendMultipleIntent(intent, context)
            else -> false
        }
    }

    private fun handleViewIntent(intent: Intent, context: Context): Boolean {
        val dataUri = intent.data ?: return false
        val scheme = dataUri.scheme?.lowercase() ?: ""

        // Case 1: Magnet URI
        if (scheme == "magnet") {
            val magnetStr = dataUri.toString()
            return dispatchMagnet(magnetStr, "ACTION_VIEW")
        }

        // Case 2: Content or File URI for .torrent
        if (scheme == "content" || scheme == "file") {
            return processTorrentUri(dataUri, intent.type, context, "ACTION_VIEW")
        }

        return false
    }

    private fun handleSendIntent(intent: Intent, context: Context): Boolean {
        // Shared text might be a magnet link
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!sharedText.isNullOrBlank() && sharedText.trim().lowercase().startsWith("magnet:?")) {
            return dispatchMagnet(sharedText.trim(), "ACTION_SEND")
        }

        // Shared stream URI
        val streamUri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        }

        if (streamUri != null) {
            return processTorrentUri(streamUri, intent.type, context, "ACTION_SEND")
        }

        return false
    }

    private fun handleSendMultipleIntent(intent: Intent, context: Context): Boolean {
        val streamUris = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
        }

        if (!streamUris.isNullOrEmpty()) {
            var anyProcessed = false
            for (uri in streamUris) {
                if (processTorrentUri(uri, intent.type, context, "ACTION_SEND_MULTIPLE")) {
                    anyProcessed = true
                }
            }
            return anyProcessed
        }
        return false
    }

    private fun processTorrentUri(
        uri: Uri,
        providedMimeType: String?,
        context: Context,
        sourceAction: String
    ): Boolean {
        val uriStr = uri.toString()
        val now = System.currentTimeMillis()

        // Debounce duplicate processing of identical URI within 1500ms
        if (uriStr == lastProcessedUri && (now - lastProcessedTimestamp) < 1500L) {
            Log.d(TAG, "Debounced duplicate URI: $uriStr")
            return false
        }

        // 1. Resolve Display Name and Size using ContentResolver
        var fileName = "imported.torrent"
        var fileSize = -1L
        val resolver = context.contentResolver

        try {
            // Attempt persistable permission grant if supported
            if (uri.scheme == "content") {
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
                try {
                    resolver.takePersistableUriPermission(uri, flags)
                } catch (e: SecurityException) {
                    // Not all content providers support persistable permissions
                }
            }

            resolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIdx != -1) {
                        cursor.getString(nameIdx)?.let { fileName = it }
                    }
                    val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIdx != -1) {
                        fileSize = cursor.getLong(sizeIdx)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to query OpenableColumns for $uri: ${e.message}")
        }

        // Fallback for file:// or content paths without display name
        if (fileName == "imported.torrent" && uri.lastPathSegment != null) {
            try {
                fileName = URLDecoder.decode(uri.lastPathSegment ?: "", "UTF-8")
            } catch (e: Exception) {
                fileName = uri.lastPathSegment ?: fileName
            }
        }

        // Clean filename (remove query parameters or illegal path characters)
        val cleanFileName = sanitizeFileName(fileName)

        // 2. Copy stream into safe application cache directory
        val cacheDir = File(context.cacheDir, "incoming_torrents").apply { mkdirs() }
        val targetFile = File(cacheDir, "${System.currentTimeMillis()}_$cleanFileName")

        try {
            val inputStream: InputStream? = if (uri.scheme == "file") {
                FileInputStream(File(uri.path ?: ""))
            } else {
                resolver.openInputStream(uri)
            }

            if (inputStream == null) {
                Log.e(TAG, "Could not open InputStream for URI: $uri")
                return false
            }

            inputStream.use { input ->
                targetFile.outputStream().use { output ->
                    input.copyTo(output, bufferSize = 8192)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error copying torrent file from $uri to ${targetFile.absolutePath}: ${e.message}")
            if (targetFile.exists()) targetFile.delete()
            return false
        }

        // 3. Validate torrent file integrity
        if (!isValidTorrentFile(targetFile)) {
            Log.e(TAG, "Invalid torrent file: ${targetFile.absolutePath} (failed bencode header checks)")
            targetFile.delete()
            return false
        }

        lastProcessedUri = uriStr
        lastProcessedTimestamp = now

        // 4. Construct payload for React Native
        val payload = Arguments.createMap().apply {
            putString("type", "torrent_file")
            putString("action", sourceAction)
            putString("uri", uriStr)
            putString("fileName", cleanFileName)
            putDouble("fileSize", targetFile.length().toDouble())
            putString("filePath", targetFile.absolutePath)
            putString("mimeType", providedMimeType ?: "application/x-bittorrent")
        }

        dispatchPayload(payload)
        return true
    }

    private fun dispatchMagnet(magnetUri: String, sourceAction: String): Boolean {
        val now = System.currentTimeMillis()
        if (magnetUri == lastProcessedUri && (now - lastProcessedTimestamp) < 1500L) {
            return false
        }

        lastProcessedUri = magnetUri
        lastProcessedTimestamp = now

        // Extract display name if present
        var dn = ""
        val dnMatch = Regex("[?&]dn=([^&]+)").find(magnetUri)
        if (dnMatch != null && dnMatch.groupValues.size > 1) {
            try {
                dn = URLDecoder.decode(dnMatch.groupValues[1].replace("+", " "), "UTF-8")
            } catch (e: Exception) {
                dn = dnMatch.groupValues[1]
            }
        }

        val payload = Arguments.createMap().apply {
            putString("type", "magnet")
            putString("action", sourceAction)
            putString("uri", magnetUri)
            putString("name", dn)
        }

        dispatchPayload(payload)
        return true
    }

    private fun dispatchPayload(payload: WritableMap) {
        val listener = intentListener
        if (listener != null) {
            listener.invoke(payload)
        } else {
            // App is not yet ready or in cold-start; save for getInitialTorrent()
            pendingInitialTorrent = payload
        }
    }

    /**
     * BitTorrent files MUST be valid bencoded dictionaries starting with 'd' (0x64)
     * and containing an "info" key ("4:info").
     */
    private fun isValidTorrentFile(file: File): Boolean {
        if (!file.exists() || file.length() < 20 || file.length() > 50 * 1024 * 1024) {
            return false
        }

        try {
            FileInputStream(file).use { fis ->
                val firstByte = fis.read()
                if (firstByte != 'd'.code) {
                    return false
                }

                // Read sample of first 4096 bytes to verify presence of "info" key
                val buffer = ByteArray(minOf(4096, file.length().toInt()))
                val bytesRead = fis.read(buffer)
                if (bytesRead > 0) {
                    val sample = String(buffer, 0, bytesRead, Charsets.ISO_8859_1)
                    if (sample.contains("4:info") || sample.contains("info")) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Validation exception for ${file.name}: ${e.message}")
            return false
        }
        return false
    }

    private fun sanitizeFileName(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9._\\-\\s()]"), "_")
            .replace("\\s+".toRegex(), " ")
            .trim()
    }
}

