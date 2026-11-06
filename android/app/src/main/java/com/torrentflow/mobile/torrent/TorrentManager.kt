package com.torrentflow.mobile.torrent

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.torrentflow.mobile.native.TorrentEngineJni
import com.torrentflow.mobile.service.TorrentDownloadService
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Singleton managing active torrent operations, background polling, and foreground service synchronization.
 */
class TorrentManager private constructor(private val context: Context) {
    private val activeTorrents = ConcurrentHashMap<String, TorrentState>()
    private val handler = Handler(Looper.getMainLooper())
    private var isPolling = false
    private var isSessionInitialized = false

    interface AlertListener {
        fun onTorrentStateUpdated(jsonState: String)
        fun onTorrentFinished(infoHash: String)
        fun onMetadataReceived(infoHash: String, metadataJson: String)
        fun onTorrentError(infoHash: String, message: String)
    }

    private val listeners = mutableSetOf<AlertListener>()

    data class TorrentState(
        val infoHash: String,
        var name: String,
        var status: String,
        var totalSize: Long,
        var downloadedBytes: Long,
        var downloadRate: Int,
        var uploadRate: Int,
        var savePath: String = "/storage/emulated/0/Download/TorrentFlow"
    )

    data class TorrentFileMeta(
        val infoHash: String,
        val name: String,
        val totalSize: Long,
        val pieceLength: Int,
        val numPieces: Int,
        val files: List<TorrentFileInfo>,
        val trackers: List<String>
    )

    data class TorrentFileInfo(
        val index: Int,
        val path: String,
        val size: Long,
        val offset: Long
    )

    companion object {
        private const val TAG = "TorrentManager"
        @Volatile
        private var INSTANCE: TorrentManager? = null

        fun getInstance(context: Context): TorrentManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: TorrentManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    fun registerListener(listener: AlertListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun unregisterListener(listener: AlertListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    fun initSession(
        downloadLimit: Int = 0,
        uploadLimit: Int = 0,
        enableDht: Boolean = true,
        enablePex: Boolean = true,
        defaultSavePath: String = "/storage/emulated/0/Download/TorrentFlow"
    ): Boolean {
        if (isSessionInitialized) return true

        val success = try {
            TorrentEngineJni.nativeInitSession(
                downloadLimit, uploadLimit, enableDht, enablePex, defaultSavePath
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing native session: ${e.message}")
            false
        }

        isSessionInitialized = true
        startAlertPolling()
        return success
    }

    fun addMagnet(magnetUri: String, savePath: String): String {
        ensureSession()
        val hash = try {
            TorrentEngineJni.nativeAddMagnet(magnetUri, savePath)
        } catch (e: Exception) {
            Log.e(TAG, "addMagnet error: ${e.message}")
            ""
        }

        if (hash.isNotEmpty()) {
            activeTorrents[hash.lowercase()] = TorrentState(
                infoHash = hash.lowercase(),
                name = "Torrent_$hash",
                status = "downloading_metadata",
                totalSize = 0,
                downloadedBytes = 0,
                downloadRate = 0,
                uploadRate = 0,
                savePath = savePath
            )
            updateForegroundService()
        }
        return hash
    }

    fun addTorrentFile(fileBytes: ByteArray, savePath: String): TorrentFileMeta {
        ensureSession()

        // 1. Parse complete metadata and compute exact info-hash from raw bencode slice
        val meta = parseTorrentMetadata(fileBytes)

        // 2. Pass to native engine
        try {
            TorrentEngineJni.nativeAddTorrentFile(fileBytes, savePath)
        } catch (e: Exception) {
            Log.e(TAG, "addTorrentFile native invocation error: ${e.message}")
        }

        // 3. Register in active torrents
        activeTorrents[meta.infoHash] = TorrentState(
            infoHash = meta.infoHash,
            name = meta.name,
            status = "downloading",
            totalSize = meta.totalSize,
            downloadedBytes = 0,
            downloadRate = 0,
            uploadRate = 0,
            savePath = savePath
        )
        updateForegroundService()
        return meta
    }

    private fun parseTorrentMetadata(bytes: ByteArray): TorrentFileMeta {
        var infoStart = -1
        var infoEnd = -1

        // Find "4:info" marker
        val pattern = "4:info".toByteArray(Charsets.ISO_8859_1)
        var i = 0
        while (i <= bytes.size - pattern.size) {
            var match = true
            for (j in pattern.indices) {
                if (bytes[i + j] != pattern[j]) {
                    match = false
                    break
                }
            }
            if (match) {
                infoStart = i + pattern.size
                break
            }
            i++
        }

        if (infoStart == -1 || infoStart >= bytes.size || bytes[infoStart] != 'd'.code.toByte()) {
            throw IllegalArgumentException("Malformed torrent: missing or invalid 'info' dictionary")
        }

        // Parse matching 'e' for the info dictionary taking string lengths into account
        var depth = 0
        var idx = infoStart
        while (idx < bytes.size) {
            val b = bytes[idx]
            if (b == 'd'.code.toByte() || b == 'l'.code.toByte()) {
                depth++
                idx++
            } else if (b == 'i'.code.toByte()) {
                idx++
                while (idx < bytes.size && bytes[idx] != 'e'.code.toByte()) idx++
                if (idx < bytes.size) idx++
            } else if (b in '0'.code.toByte()..'9'.code.toByte()) {
                var colon = idx
                while (colon < bytes.size && bytes[colon] != ':'.code.toByte()) colon++
                val lenStr = String(bytes, idx, colon - idx, Charsets.US_ASCII)
                val len = lenStr.toIntOrNull() ?: 0
                idx = colon + 1 + len
            } else if (b == 'e'.code.toByte()) {
                depth--
                idx++
                if (depth == 0) {
                    infoEnd = idx
                    break
                }
            } else {
                idx++
            }
        }

        if (infoEnd == -1 || infoEnd <= infoStart) {
            throw IllegalArgumentException("Malformed torrent: unterminated 'info' dictionary")
        }

        // Calculate exact BitTorrent info-hash using SHA-1 over the exact byte range
        val md = MessageDigest.getInstance("SHA-1")
        md.update(bytes, infoStart, infoEnd - infoStart)
        val hash = md.digest().joinToString("") { "%02x".format(it) }

        // Extract basic metadata: name, totalSize, pieceLength, pieces, files, trackers
        val rawStr = String(bytes, Charsets.ISO_8859_1)

        // Name
        var name = "Torrent_${hash.take(8)}"
        val nameMatch = Regex("4:name(\\d+):").find(rawStr)
        if (nameMatch != null) {
            val len = nameMatch.groupValues[1].toIntOrNull() ?: 0
            val start = nameMatch.range.last + 1
            if (start + len <= rawStr.length) {
                name = String(bytes, start, len, Charsets.UTF_8)
            }
        }

        // Piece length
        var pieceLength = 262144
        val plMatch = Regex("12:piece lengthi(\\d+)e").find(rawStr)
        if (plMatch != null) {
            pieceLength = plMatch.groupValues[1].toIntOrNull() ?: pieceLength
        }

        // Pieces count
        var numPieces = 1
        val piecesMatch = Regex("6:pieces(\\d+):").find(rawStr)
        if (piecesMatch != null) {
            val piecesLen = piecesMatch.groupValues[1].toIntOrNull() ?: 0
            numPieces = maxOf(1, piecesLen / 20)
        }

        // Total size and files
        var totalSize = 0L
        val fileList = mutableListOf<TorrentFileInfo>()

        // Check single file length
        val singleLenMatch = Regex("6:lengthi(\\d+)e").find(rawStr)
        if (singleLenMatch != null && !rawStr.contains("5:filesl")) {
            totalSize = singleLenMatch.groupValues[1].toLongOrNull() ?: 0L
            fileList.add(TorrentFileInfo(0, name, totalSize, 0L))
        } else {
            // Multi-file layout
            var currOffset = 0L
            val fileRegex = Regex("d6:lengthi(\\d+)e4:pathl([^e]+)ee")
            var idxF = 0
            fileRegex.findAll(rawStr).forEach { matchRes ->
                val fLen = matchRes.groupValues[1].toLongOrNull() ?: 0L
                val pathSegmentStr = matchRes.groupValues[2]
                val pathSegments = mutableListOf<String>()
                Regex("(\\d+):([a-zA-Z0-9._\\-\\s]+)").findAll(pathSegmentStr).forEach { pSeg ->
                    pathSegments.add(pSeg.groupValues[2])
                }
                val relPath = if (pathSegments.isNotEmpty()) pathSegments.joinToString("/") else "file_$idxF"
                fileList.add(TorrentFileInfo(idxF, "$name/$relPath", fLen, currOffset))
                currOffset += fLen
                totalSize += fLen
                idxF++
            }
            if (fileList.isEmpty() && totalSize == 0L) {
                totalSize = 10485760L // 10MB default
                fileList.add(TorrentFileInfo(0, name, totalSize, 0L))
            }
        }

        // Trackers
        val trackers = mutableListOf<String>()
        val announceMatch = Regex("8:announce(\\d+):([^\ne]+)").find(rawStr)
        if (announceMatch != null) {
            val trLen = announceMatch.groupValues[1].toIntOrNull() ?: 0
            val trStr = announceMatch.groupValues[2].take(trLen)
            if (trStr.startsWith("http://") || trStr.startsWith("https://") || trStr.startsWith("udp://")) {
                trackers.add(trStr)
            }
        }

        return TorrentFileMeta(
            infoHash = hash.lowercase(),
            name = name,
            totalSize = totalSize,
            pieceLength = pieceLength,
            numPieces = numPieces,
            files = fileList,
            trackers = trackers
        )
    }

    fun pauseTorrent(infoHash: String): Boolean {
        val h = infoHash.lowercase()
        val success = try {
            TorrentEngineJni.nativePauseTorrent(h)
        } catch (e: Exception) {
            false
        }
        activeTorrents[h]?.let { it.status = "paused" }
        updateForegroundService()
        return success
    }

    fun resumeTorrent(infoHash: String): Boolean {
        val h = infoHash.lowercase()
        val success = try {
            TorrentEngineJni.nativeResumeTorrent(h)
        } catch (e: Exception) {
            false
        }
        activeTorrents[h]?.let { it.status = "downloading" }
        updateForegroundService()
        return success
    }

    fun removeTorrent(infoHash: String, deleteFiles: Boolean): Boolean {
        val h = infoHash.lowercase()
        val state = activeTorrents[h]

        // 1. Remove from native engine session and pause/stop transfers
        val success = try {
            TorrentEngineJni.nativeRemoveTorrent(h, deleteFiles)
        } catch (e: Exception) {
            Log.e(TAG, "Native removeTorrent invocation error: ${e.message}")
            false
        }

        // 2. If deleteFiles requested, safely purge physical files from disk
        if (deleteFiles && state != null) {
            safelyDeleteTorrentFiles(state)
        }

        // 3. Remove from active manager state
        activeTorrents.remove(h)
        updateForegroundService()
        return success
    }

    /**
     * Safely deletes downloaded files and folders associated with the torrent.
     * Enforces strict path traversal prevention and ensures files are strictly inside savePath.
     */
    private fun safelyDeleteTorrentFiles(state: TorrentState) {
        val savePathStr = state.savePath.ifEmpty { "/storage/emulated/0/Download/TorrentFlow" }
        val baseDir = File(savePathStr)
        if (!baseDir.exists()) return

        val canonicalBase = try {
            baseDir.canonicalFile
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resolve canonical path for base dir: $savePathStr", e)
            return
        }

        // Prevent deletion of root system or broad device directories
        val forbiddenDirs = listOf("/", "/storage", "/storage/emulated", "/storage/emulated/0", "/sdcard", "/system", "/data")
        if (canonicalBase.absolutePath in forbiddenDirs) {
            Log.e(TAG, "Refusing to delete files in protected root/system directory: ${canonicalBase.absolutePath}")
            return
        }

        // Target file or directory name
        val safeName = state.name.trim()
        if (safeName.isEmpty() || safeName == "." || safeName == ".." || safeName.contains("..") || safeName.contains("/") || safeName.contains("\\")) {
            Log.e(TAG, "Suspicious or invalid torrent name for file deletion: $safeName")
            return
        }

        val targetFile = File(canonicalBase, safeName)
        val canonicalTarget = try {
            targetFile.canonicalFile
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resolve canonical path for target: ${targetFile.absolutePath}", e)
            return
        }

        // Verify that canonicalTarget is strictly a child of canonicalBase
        if (!canonicalTarget.absolutePath.startsWith(canonicalBase.absolutePath + File.separator)) {
            Log.e(TAG, "Path traversal detected! Target '${canonicalTarget.absolutePath}' is outside base '${canonicalBase.absolutePath}'")
            return
        }

        // Never delete the base download directory itself
        if (canonicalTarget.absolutePath == canonicalBase.absolutePath) {
            Log.e(TAG, "Safety violation: Target cannot be identical to base download directory.")
            return
        }

        try {
            if (canonicalTarget.exists()) {
                if (canonicalTarget.isDirectory) {
                    val deleted = canonicalTarget.deleteRecursively()
                    Log.i(TAG, "Deleted torrent directory ${canonicalTarget.absolutePath}: $deleted")
                } else if (canonicalTarget.isFile) {
                    val deleted = canonicalTarget.delete()
                    Log.i(TAG, "Deleted torrent file ${canonicalTarget.absolutePath}: $deleted")
                }
            }

            // Also check for any .part files or resume files matching hash or name
            val partFile = File(canonicalBase, "$safeName.part")
            if (partFile.exists()) {
                val canPart = partFile.canonicalFile
                if (canPart.absolutePath.startsWith(canonicalBase.absolutePath + File.separator)) {
                    canPart.delete()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception during safe torrent file deletion: ${e.message}", e)
        }
    }

    private fun ensureSession() {
        if (!isSessionInitialized) {
            initSession()
        }
    }

    private fun startAlertPolling() {
        if (isPolling) return
        isPolling = true

        Thread {
            while (isPolling) {
                try {
                    val rawAlerts = TorrentEngineJni.nativePollAlerts()
                    if (rawAlerts.isNotEmpty() && rawAlerts != "[]") {
                        processAlertsJson(rawAlerts)
                    }
                    Thread.sleep(500)
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Alert polling exception: ${e.message}")
                }
            }
        }.apply {
            name = "TorrentFlowAlertThread"
            isDaemon = true
            start()
        }
    }

    private fun processAlertsJson(jsonStr: String) {
        try {
            val arr = JSONArray(jsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val type = obj.optString("type")
                val hash = obj.optString("info_hash")

                synchronized(listeners) {
                    for (l in listeners) {
                        when (type) {
                            "state_update" -> l.onTorrentStateUpdated(obj.toString())
                            "torrent_finished" -> l.onTorrentFinished(hash)
                            "metadata_received" -> l.onMetadataReceived(hash, obj.toString())
                            "torrent_error" -> l.onTorrentError(hash, obj.optString("error_message"))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse alerts: ${e.message}")
        }
    }

    private fun updateForegroundService() {
        val activeCount = activeTorrents.values.count { it.status == "downloading" || it.status == "downloading_metadata" }

        if (activeCount > 0) {
            val intent = Intent(context, TorrentDownloadService::class.java).apply {
                action = TorrentDownloadService.ACTION_START_OR_UPDATE
                putExtra("active_count", activeCount)
                val totalRate = activeTorrents.values.sumOf { it.downloadRate }
                putExtra("download_rate", totalRate)
            }
            try {
                context.startForegroundService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Cannot start foreground service: ${e.message}")
            }
        } else {
            val stopIntent = Intent(context, TorrentDownloadService::class.java).apply {
                action = TorrentDownloadService.ACTION_STOP
            }
            context.stopService(stopIntent)
        }
    }
}

