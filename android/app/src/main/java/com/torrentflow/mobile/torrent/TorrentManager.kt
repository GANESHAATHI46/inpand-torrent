package com.torrentflow.mobile.torrent

import android.content.Context
import android.content.Intent
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.torrentflow.mobile.service.TorrentDownloadService
import org.json.JSONArray
import org.json.JSONObject
import org.libtorrent4j.*
import org.libtorrent4j.alerts.*
import java.io.File
import java.net.URLDecoder
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Authoritative BitTorrent Manager powered by rasterbar libtorrent 2.1.x (via libtorrent4j).
 * Manages native session lifecycle, alerts, DHT/trackers, peer transfers, and foreground service synchronization.
 */
class TorrentManager private constructor(private val context: Context) {

    private val sessionManager = SessionManager()
    private val activeTorrents = ConcurrentHashMap<String, TorrentState>()
    private val listeners = mutableSetOf<TorrentEventListener>()
    private val handler = Handler(Looper.getMainLooper())

    @Volatile
    private var isSessionInitialized = false

    @Volatile
    private var isPolling = false

    interface TorrentEventListener {
        fun onTorrentStateUpdated(jsonState: String)
        fun onTorrentFinished(infoHash: String)
        fun onMetadataReceived(infoHash: String, metadataJson: String)
        fun onTorrentError(infoHash: String, message: String)
    }

    data class TorrentState(
        val infoHash: String,
        var name: String,
        var status: String,
        var totalSize: Long,
        var downloadedBytes: Long,
        var uploadedBytes: Long = 0L,
        var downloadRate: Int = 0,
        var uploadRate: Int = 0,
        var numSeeds: Int = 0,
        var numPeers: Int = 0,
        var totalSeeds: Int = 0,
        var totalPeers: Int = 0,
        var progress: Float = 0.0f,
        var piecesProgress: String = "",
        var savePath: String = ""
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

    fun registerListener(listener: TorrentEventListener) {
        synchronized(listeners) {
            listeners.add(listener)
        }
    }

    fun unregisterListener(listener: TorrentEventListener) {
        synchronized(listeners) {
            listeners.remove(listener)
        }
    }

    /**
     * Initializes the real rasterbar libtorrent 2.1.x session with DHT, PEX, LSD, and alert processing.
     */
    fun initSession(
        downloadLimit: Int = 0,
        uploadLimit: Int = 0,
        enableDht: Boolean = true,
        enablePex: Boolean = true,
        defaultSavePath: String = ""
    ): Boolean {
        if (isSessionInitialized) return true

        synchronized(this) {
            if (isSessionInitialized) return true

            try {
                Log.i(TAG, "Initializing rasterbar libtorrent 2.1.x native session...")

                sessionManager.addListener(object : org.libtorrent4j.AlertListener {
                    override fun types(): IntArray? = null
                    override fun alert(alert: Alert<*>) {
                        handleNativeAlert(alert)
                    }
                })

                sessionManager.start()

                if (downloadLimit > 0) {
                    sessionManager.downloadRateLimit(downloadLimit)
                }
                if (uploadLimit > 0) {
                    sessionManager.uploadRateLimit(uploadLimit)
                }

                isSessionInitialized = true
                startPollingLoop()

                Log.i(TAG, "rasterbar libtorrent 2.1.x session initialized successfully. DHT active.")
                return true
            } catch (t: Throwable) {
                Log.e(TAG, "Failed to initialize rasterbar libtorrent session: ${t.message}", t)
                return false
            }
        }
    }

    private fun ensureSession() {
        if (!isSessionInitialized) {
            initSession()
        }
    }

    /**
     * Adds a magnet URI to the native libtorrent session.
     * Automatically retrieves metadata over BEP 9/10 and transitions to downloading.
     */
    fun addMagnet(magnetUri: String, savePath: String): String {
        ensureSession()
        val effectivePath = getEffectiveSavePath(savePath)
        val saveDir = File(effectivePath)
        if (!saveDir.exists()) saveDir.mkdirs()

        // Extract info-hash from magnet URI
        var hash = ""
        val match = Regex("xt=urn:btih:([a-zA-Z0-9]+)", RegexOption.IGNORE_CASE).find(magnetUri)
        if (match != null) {
            hash = match.groupValues[1].lowercase()
        }

        if (hash.isEmpty()) {
            Log.e(TAG, "Cannot add magnet: invalid info-hash in $magnetUri")
            return ""
        }

        // Extract display name if present
        val nameMatch = Regex("dn=([^&]+)").find(magnetUri)
        val magnetName = if (nameMatch != null) {
            try {
                URLDecoder.decode(nameMatch.groupValues[1], "UTF-8")
            } catch (e: Exception) {
                "Magnet_${hash.take(8)}"
            }
        } else {
            "Magnet_${hash.take(8)}"
        }

        try {
            Log.i(TAG, "Adding magnet to libtorrent: $magnetName ($hash) -> $effectivePath")
            sessionManager.download(magnetUri, saveDir, org.libtorrent4j.swig.torrent_flags_t())

            activeTorrents[hash] = TorrentState(
                infoHash = hash,
                name = magnetName,
                status = "downloading_metadata",
                totalSize = 0L,
                downloadedBytes = 0L,
                savePath = effectivePath
            )

            updateForegroundService()
            return hash
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to add magnet to libtorrent: ${t.message}", t)
            return ""
        }
    }

    /**
     * Adds a .torrent file to the native libtorrent session from bencoded raw bytes.
     */
    fun addTorrentFile(fileBytes: ByteArray, savePath: String): TorrentFileMeta {
        ensureSession()
        val effectivePath = getEffectiveSavePath(savePath)
        val saveDir = File(effectivePath)
        if (!saveDir.exists()) saveDir.mkdirs()

        // 1. Decode using libtorrent's native parser
        val ti = TorrentInfo.bdecode(fileBytes)
        val infoHash = ti.infoHash().toHex().lowercase()
        val name = ti.name().ifBlank { "Torrent_${infoHash.take(8)}" }
        val totalSize = ti.totalSize()
        val pieceLength = ti.pieceLength()
        val numPieces = ti.numPieces()

        // 2. Extract multi-file list
        val fileList = mutableListOf<TorrentFileInfo>()
        val fs = ti.files()
        for (i in 0 until fs.numFiles()) {
            fileList.add(
                TorrentFileInfo(
                    index = i,
                    path = fs.filePath(i),
                    size = fs.fileSize(i),
                    offset = fs.fileOffset(i)
                )
            )
        }

        // 3. Extract trackers from our bencode parser fallback or metadata
        val trackers = extractTrackersFromBytes(fileBytes)

        // 4. Add to libtorrent session
        try {
            Log.i(TAG, "Adding .torrent to libtorrent: $name ($infoHash) -> $effectivePath")
            sessionManager.download(ti, saveDir)

            activeTorrents[infoHash] = TorrentState(
                infoHash = infoHash,
                name = name,
                status = "downloading",
                totalSize = totalSize,
                downloadedBytes = 0L,
                savePath = effectivePath
            )

            updateForegroundService()
        } catch (t: Throwable) {
            Log.e(TAG, "Failed adding .torrent to libtorrent: ${t.message}", t)
            throw t
        }

        return TorrentFileMeta(
            infoHash = infoHash,
            name = name,
            totalSize = totalSize,
            pieceLength = pieceLength,
            numPieces = numPieces,
            files = fileList,
            trackers = trackers
        )
    }

    /**
     * Pauses an active torrent in libtorrent.
     */
    fun pauseTorrent(infoHash: String): Boolean {
        val h = infoHash.lowercase()
        activeTorrents[h]?.let { it.status = "paused" }

        return try {
            val th = sessionManager.find(Sha1Hash.parseHex(h))
            if (th != null && th.isValid) {
                th.pause()
                updateForegroundService()
                true
            } else {
                false
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Error pausing torrent $h: ${t.message}", t)
            false
        }
    }

    /**
     * Resumes a paused torrent in libtorrent.
     */
    fun resumeTorrent(infoHash: String): Boolean {
        val h = infoHash.lowercase()
        activeTorrents[h]?.let { it.status = "downloading" }

        return try {
            val th = sessionManager.find(Sha1Hash.parseHex(h))
            if (th != null && th.isValid) {
                th.resume()
                updateForegroundService()
                true
            } else {
                false
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Error resuming torrent $h: ${t.message}", t)
            false
        }
    }

    /**
     * Removes a torrent from the libtorrent session and optionally deletes downloaded files.
     */
    fun removeTorrent(infoHash: String, deleteFiles: Boolean): Boolean {
        val h = infoHash.lowercase()
        val st = activeTorrents.remove(h)

        return try {
            val th = sessionManager.find(Sha1Hash.parseHex(h))
            if (th != null && th.isValid) {
                sessionManager.remove(th)
            }

            if (deleteFiles && st != null) {
                val target = File(st.savePath, st.name)
                if (target.exists()) {
                    target.deleteRecursively()
                }
            }

            updateForegroundService()
            true
        } catch (t: Throwable) {
            Log.e(TAG, "Error removing torrent $h: ${t.message}", t)
            false
        }
    }

    /**
     * Restores a previously saved torrent session from SQLite.
     */
    fun restoreTorrent(
        infoHash: String,
        name: String,
        savePath: String,
        totalSize: Long,
        downloadedBytes: Long,
        status: String
    ): Boolean {
        ensureSession()
        val effectivePath = getEffectiveSavePath(savePath)
        val h = infoHash.lowercase()

        activeTorrents[h] = TorrentState(
            infoHash = h,
            name = name,
            status = status,
            totalSize = totalSize,
            downloadedBytes = downloadedBytes,
            savePath = effectivePath
        )

        if (status != "paused" && status != "finished" && status != "error") {
            try {
                val th = sessionManager.find(Sha1Hash.parseHex(h))
                if (th == null || !th.isValid) {
                    val magnetUri = "magnet:?xt=urn:btih:$h&dn=${URLDecoder.decode(name, "UTF-8")}"
                    val saveDir = File(effectivePath)
                    if (!saveDir.exists()) saveDir.mkdirs()
                    sessionManager.download(magnetUri, saveDir, org.libtorrent4j.swig.torrent_flags_t())
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Could not resume torrent $h in libtorrent: ${t.message}")
            }
        }

        updateForegroundService()
        return true
    }

    /**
     * Handles incoming alerts from the native libtorrent engine.
     */
    private fun handleNativeAlert(alert: Alert<*>) {
        when (alert.type()) {
            AlertType.METADATA_RECEIVED -> {
                val ma = alert as? MetadataReceivedAlert ?: return
                val th = ma.handle()
                if (th != null && th.isValid) {
                    val h = th.infoHash().toHex().lowercase()
                    val ti = th.torrentFile()
                    if (ti != null && ti.isValid) {
                        val name = ti.name()
                        val totalSize = ti.totalSize()
                        val pieceLength = ti.pieceLength()
                        val numPieces = ti.numPieces()

                        activeTorrents[h]?.let { st ->
                            st.name = name
                            st.totalSize = totalSize
                            st.status = "downloading"
                        }

                        val json = JSONObject().apply {
                            put("infoHash", h)
                            put("name", name)
                            put("totalSize", totalSize)
                            put("pieceLength", pieceLength)
                            put("numPieces", numPieces)
                        }

                        synchronized(listeners) {
                            for (l in listeners) {
                                l.onMetadataReceived(h, json.toString())
                            }
                        }
                        updateForegroundService()
                    }
                }
            }

            AlertType.TORRENT_FINISHED -> {
                val fa = alert as? TorrentFinishedAlert ?: return
                val th = fa.handle()
                if (th != null && th.isValid) {
                    val h = th.infoHash().toHex().lowercase()
                    activeTorrents[h]?.let { st ->
                        st.status = "finished"
                        st.downloadRate = 0
                    }
                    th.saveResumeData()

                    synchronized(listeners) {
                        for (l in listeners) {
                            l.onTorrentFinished(h)
                        }
                    }
                    updateForegroundService()
                }
            }

            AlertType.TORRENT_ERROR -> {
                val ea = alert as? TorrentErrorAlert ?: return
                val th = ea.handle()
                val h = th?.infoHash()?.toHex()?.lowercase() ?: ""
                val msg = ea.error().message.ifEmpty { ea.message() }
                Log.e(TAG, "libtorrent error for $h: $msg")

                if (h.isNotEmpty()) {
                    activeTorrents[h]?.status = "error"
                    synchronized(listeners) {
                        for (l in listeners) {
                            l.onTorrentError(h, msg)
                        }
                    }
                }
            }

            AlertType.SAVE_RESUME_DATA -> {
                val sra = alert as? SaveResumeDataAlert ?: return
                val th = sra.handle()
                if (th != null && th.isValid) {
                    val h = th.infoHash().toHex().lowercase()
                    Log.i(TAG, "Fast-resume data generated for $h")
                }
            }

            else -> {
                // Other libtorrent informational alerts
            }
        }
    }

    /**
     * Dedicated background polling loop querying libtorrent handles every 500ms for exact speeds,
     * progress, seeds, peers, and piece bitfields.
     */
    private fun startPollingLoop() {
        if (isPolling) return
        isPolling = true

        Thread {
            while (isPolling) {
                try {
                    sessionManager.postTorrentUpdates()

                    for ((hash, st) in activeTorrents) {
                        try {
                            val th = sessionManager.find(Sha1Hash.parseHex(hash))
                            if (th != null && th.isValid) {
                                val status = th.status()

                                val isPaused = st.status == "paused" || status.flags().and_(TorrentFlags.PAUSED).non_zero()
                                val currentStatus = when (status.state()) {
                                    TorrentStatus.State.CHECKING_FILES,
                                    TorrentStatus.State.CHECKING_RESUME_DATA -> "checking"
                                    TorrentStatus.State.DOWNLOADING_METADATA -> "downloading_metadata"
                                    TorrentStatus.State.DOWNLOADING -> {
                                        if (isPaused) {
                                            "paused"
                                        } else if (status.numPeers() == 0 && status.downloadPayloadRate() == 0) {
                                            "connecting_peers"
                                        } else {
                                            "downloading"
                                        }
                                    }
                                    TorrentStatus.State.FINISHED -> "finished"
                                    TorrentStatus.State.SEEDING -> "seeding"
                                    else -> if (isPaused) "paused" else "downloading"
                                }

                                st.downloadedBytes = status.totalDone()
                                st.uploadedBytes = status.totalUpload()
                                st.downloadRate = status.downloadPayloadRate()
                                st.uploadRate = status.uploadPayloadRate()
                                st.numSeeds = status.numSeeds()
                                st.numPeers = status.numPeers()
                                st.totalSeeds = status.numComplete()
                                st.totalPeers = status.numIncomplete()
                                st.progress = status.progress()
                                st.status = currentStatus

                                if (st.totalSize <= 0 && status.totalWanted() > 0) {
                                    st.totalSize = status.totalWanted()
                                }

                                // Build piece availability bitmask string (sample up to 60 blocks for UI)
                                val pieces = status.pieces()
                                val piecesStr = StringBuilder()
                                if (pieces != null && pieces.size() > 0) {
                                    val totalP = pieces.size()
                                    val samples = minOf(60, totalP)
                                    for (s in 0 until samples) {
                                        val pIdx = ((s.toDouble() / samples) * totalP).toInt().coerceAtMost(totalP - 1)
                                        piecesStr.append(if (pieces.getBit(pIdx)) '1' else '0')
                                    }
                                }
                                st.piecesProgress = piecesStr.toString()

                                // Notify React Native UI
                                val json = JSONObject().apply {
                                    put("type", "state_update")
                                    put("info_hash", hash)
                                    put("infoHash", hash)
                                    put("downloadedBytes", st.downloadedBytes)
                                    put("uploadedBytes", st.uploadedBytes)
                                    put("downloadRate", st.downloadRate)
                                    put("uploadRate", st.uploadRate)
                                    put("numSeeds", st.numSeeds)
                                    put("numPeers", st.numPeers)
                                    put("totalSeeds", st.totalSeeds)
                                    put("totalPeers", st.totalPeers)
                                    put("progress", st.progress.toDouble())
                                    put("status", st.status)
                                    put("piecesProgress", st.piecesProgress)
                                }

                                synchronized(listeners) {
                                    for (l in listeners) {
                                        l.onTorrentStateUpdated(json.toString())
                                    }
                                }
                            }
                        } catch (itemErr: Exception) {
                            // Ignore single torrent handle resolution error
                        }
                    }

                    updateForegroundService()
                    Thread.sleep(500)
                } catch (ie: InterruptedException) {
                    break
                } catch (t: Throwable) {
                    Log.w(TAG, "Polling loop exception: ${t.message}")
                    try { Thread.sleep(1000) } catch (e: Exception) { break }
                }
            }
        }.apply {
            name = "InpandLibtorrentPollThread"
            isDaemon = true
            start()
        }
    }

    /**
     * Synchronizes active BitTorrent transfers with the Android Foreground Service.
     */
    private fun updateForegroundService() {
        try {
            var activeDownloads = 0
            var totalDownloadRate = 0

            for (st in activeTorrents.values) {
                if (st.status == "downloading" || st.status == "downloading_metadata" || st.status == "connecting_peers") {
                    activeDownloads++
                    totalDownloadRate += st.downloadRate
                }
            }

            val svcIntent = Intent(context, TorrentDownloadService::class.java)
            if (activeDownloads > 0) {
                svcIntent.action = TorrentDownloadService.ACTION_START_OR_UPDATE
                svcIntent.putExtra("active_count", activeDownloads)
                svcIntent.putExtra("download_rate", totalDownloadRate)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(svcIntent)
                } else {
                    context.startService(svcIntent)
                }
            } else {
                svcIntent.action = TorrentDownloadService.ACTION_STOP
                context.startService(svcIntent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error updating TorrentDownloadService: ${e.message}")
        }
    }

    /**
     * Resolves a guaranteed writable storage directory on Android conforming to Scoped Storage.
     * Never falls back to /data/local/tmp.
     */
    fun getEffectiveSavePath(requestedPath: String): String {
        // 1. Try requested path if non-empty and writable
        if (requestedPath.isNotBlank()) {
            try {
                val f = File(requestedPath)
                if (!f.exists()) f.mkdirs()
                if (f.exists() && f.canWrite()) {
                    val test = File(f, ".test_${System.currentTimeMillis()}")
                    if (test.createNewFile()) {
                        test.delete()
                        return f.absolutePath
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Requested savePath '$requestedPath' not directly writable: ${e.message}")
            }
        }

        // 2. Primary Guaranteed Destination: App-specific external storage
        // /storage/emulated/0/Android/data/com.torrentflow.mobile/files/Download
        // 100% accessible to native C++ file I/O across Android 10-15 without special permissions
        try {
            val ext = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            if (ext != null) {
                if (!ext.exists()) ext.mkdirs()
                if (ext.canWrite()) return ext.absolutePath
            }
        } catch (e: Exception) {
            Log.w(TAG, "External files dir failed: ${e.message}")
        }

        // 3. Fallback: Internal app storage
        val internal = File(context.filesDir, "downloads")
        if (!internal.exists()) internal.mkdirs()
        return internal.absolutePath
    }

    /**
     * Helper to extract announce URLs from raw .torrent file bytes.
     */
    private fun extractTrackersFromBytes(bytes: ByteArray): List<String> {
        val trackers = mutableListOf<String>()
        val text = String(bytes, Charsets.ISO_8859_1)

        // 1. Single announce
        val announceIdx = text.indexOf("8:announce")
        if (announceIdx != -1) {
            val colon = text.indexOf(':', announceIdx + 10)
            if (colon != -1) {
                val lenStr = text.substring(announceIdx + 10, colon)
                val len = lenStr.toIntOrNull() ?: 0
                val start = colon + 1
                if (start + len <= text.length) {
                    val url = text.substring(start, start + len).trim()
                    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("udp://")) {
                        trackers.add(url)
                    }
                }
            }
        }

        // 2. Multi-tracker announce-list
        val listIdx = text.indexOf("13:announce-list")
        if (listIdx != -1) {
            var searchIdx = listIdx + 16
            while (searchIdx < text.length - 10) {
                val colon = text.indexOf(':', searchIdx)
                if (colon == -1 || colon - searchIdx > 6) break
                val lenStr = text.substring(searchIdx, colon)
                val len = lenStr.toIntOrNull()
                if (len == null || len <= 0) {
                    searchIdx++
                    continue
                }
                val start = colon + 1
                if (start + len <= text.length) {
                    val candidate = text.substring(start, start + len).trim()
                    if (candidate.startsWith("http://") || candidate.startsWith("https://") || candidate.startsWith("udp://")) {
                        if (!trackers.contains(candidate)) trackers.add(candidate)
                    }
                    searchIdx = start + len
                } else {
                    break
                }
            }
        }

        return trackers
    }
}
