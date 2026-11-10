package com.torrentflow.mobile.torrent

import android.util.Log
import java.io.*
import java.net.*
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.SecureRandom
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.ceil
import kotlin.math.min

/**
 * High-performance autonomous BitTorrent Swarm Engine in Kotlin.
 * Implements BEP 3 (BitTorrent Protocol), BEP 15 (UDP Tracker Protocol),
 * and BEP 23 (Compact Tracker Responses).
 */
class TorrentDownloadWorker(
    val infoHash: String,
    val name: String,
    val totalSize: Long,
    val pieceLength: Int,
    val numPieces: Int,
    val savePath: String,
    val trackers: List<String>,
    private val callback: ProgressCallback
) {
    interface ProgressCallback {
        fun onProgressUpdate(
            downloadedBytes: Long,
            uploadedBytes: Long,
            downloadRate: Int,
            uploadRate: Int,
            numSeeds: Int,
            numPeers: Int,
            status: String
        )
        fun onFinished()
        fun onError(message: String)
    }

    companion object {
        private const val TAG = "TorrentWorker"
        private const val BLOCK_SIZE = 16384 // 16 KB standard BitTorrent block
        private const val MAX_ACTIVE_PEERS = 20
        private const val SOCKET_TIMEOUT_MS = 6000

        // Public high-speed backup trackers used when torrent trackers are offline or restricted
        val DEFAULT_PUBLIC_TRACKERS = listOf(
            "udp://tracker.opentrackr.org:1337/announce",
            "http://tracker.opentrackr.org:1337/announce",
            "udp://open.stealth.si:80/announce",
            "udp://tracker.torrent.eu.org:451/announce",
            "udp://tracker.bittor.pw:1337/announce",
            "udp://explodie.org:6969/announce",
            "udp://tracker.openbittorrent.com:6969/announce",
            "http://tracker.openbittorrent.com:80/announce",
            "udp://tracker.cyberia.is:6969/announce",
            "udp://p4p.arenabg.com:1337/announce"
        )
    }

    private val isRunning = AtomicBoolean(false)
    private val isPaused = AtomicBoolean(false)
    private val downloadedBytes = AtomicLong(0)
    private val uploadedBytes = AtomicLong(0)
    private val activeConnectedPeers = AtomicInteger(0)
    private val activeConnectedSeeds = AtomicInteger(0)

    private val executor = Executors.newCachedThreadPool { r ->
        Thread(r, "TorrentWorker-$name").apply { isDaemon = true }
    }

    // 20-byte Peer ID: -IT1000- + 12 random characters
    private val peerIdBytes: ByteArray = run {
        val prefix = "-IT1000-".toByteArray(Charsets.US_ASCII)
        val rand = ByteArray(12)
        SecureRandom().nextBytes(rand)
        prefix + rand
    }

    // 20-byte Info-Hash
    private val infoHashBytes: ByteArray = run {
        val clean = infoHash.lowercase().trim()
        val bytes = ByteArray(20)
        for (i in 0 until 20) {
            bytes[i] = clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
        bytes
    }

    // Destination file handle
    private var randomAccessFile: RandomAccessFile? = null
    private var destinationFile: File? = null

    // Track discovered peers: "IP:Port"
    private val discoveredPeers = ConcurrentHashMap.newKeySet<String>()
    private val connectedPeerSockets = ConcurrentHashMap<String, Socket>()

    // Speed calculation
    private var lastMeasuredBytes = 0L
    private var lastMeasuredTime = System.currentTimeMillis()
    private var currentDownloadRate = 0

    fun start(initialDownloadedBytes: Long = 0) {
        if (isRunning.getAndSet(true)) return
        isPaused.set(false)
        downloadedBytes.set(initialDownloadedBytes)

        try {
            var baseDir = File(savePath)
            if (!baseDir.exists()) baseDir.mkdirs()

            val safeName = name.replace(Regex("[/\\\\:*?\"<>|]"), "_").trim().ifEmpty { "download_$infoHash" }
            var target = File(baseDir, safeName)

            var raf: RandomAccessFile? = null
            try {
                raf = RandomAccessFile(target, "rw")
            } catch (e: Exception) {
                Log.w(TAG, "Direct RandomAccessFile failed on $target, trying fallback location", e)
                val fallbackDir = File(System.getProperty("java.io.tmpdir") ?: "/data/local/tmp")
                if (!fallbackDir.exists()) fallbackDir.mkdirs()
                target = File(fallbackDir, safeName)
                raf = RandomAccessFile(target, "rw")
            }
            destinationFile = target
            if (target.length() < totalSize && totalSize > 0) {
                try {
                    raf.setLength(totalSize)
                } catch (e: Exception) {
                    // Preallocation fallback
                }
            }
            randomAccessFile = raf
        } catch (e: Exception) {
            Log.e(TAG, "Failed creating destination file: ${e.message}", e)
        }

        // 1. Start tracker announce thread
        executor.submit { runTrackerAnnounceLoop() }

        // 2. Start peer swarm connector loop
        executor.submit { runPeerSwarmConnectorLoop() }

        // 3. Start telemetry & rate reporting loop
        executor.submit { runRateMeasurementLoop() }

        Log.i(TAG, "TorrentDownloadWorker started for '$name' ($infoHash)")
    }

    fun pause() {
        isPaused.set(true)
        closeAllSockets()
        callback.onProgressUpdate(
            downloadedBytes.get(),
            uploadedBytes.get(),
            0,
            0,
            0,
            0,
            "paused"
        )
    }

    fun resume() {
        if (isPaused.getAndSet(false)) {
            executor.submit { runTrackerAnnounceLoop() }
            executor.submit { runPeerSwarmConnectorLoop() }
        }
    }

    fun stop(deleteFiles: Boolean = false) {
        isRunning.set(false)
        isPaused.set(false)
        closeAllSockets()

        try {
            randomAccessFile?.close()
            randomAccessFile = null
        } catch (e: Exception) {
            // Ignore
        }

        if (deleteFiles) {
            try {
                destinationFile?.delete()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete file on stop: ${e.message}")
            }
        }

        executor.shutdownNow()
    }

    private fun closeAllSockets() {
        for ((_, sock) in connectedPeerSockets) {
            try {
                sock.close()
            } catch (e: Exception) {
                // Ignore
            }
        }
        connectedPeerSockets.clear()
        activeConnectedPeers.set(0)
        activeConnectedSeeds.set(0)
    }

    private fun runRateMeasurementLoop() {
        while (isRunning.get()) {
            try {
                Thread.sleep(500)
                if (isPaused.get()) continue

                val now = System.currentTimeMillis()
                val currentBytes = downloadedBytes.get()
                val timeDiff = (now - lastMeasuredTime) / 1000.0

                if (timeDiff >= 0.5) {
                    val bytesDiff = currentBytes - lastMeasuredBytes
                    currentDownloadRate = if (bytesDiff > 0 && timeDiff > 0) {
                        (bytesDiff / timeDiff).toInt()
                    } else {
                        0
                    }
                    lastMeasuredBytes = currentBytes
                    lastMeasuredTime = now
                }

                val peers = activeConnectedPeers.get()
                val seeds = activeConnectedSeeds.get()
                val isFinished = totalSize > 0 && currentBytes >= totalSize

                val status = when {
                    isFinished -> "finished"
                    currentDownloadRate > 0 || peers > 0 -> "downloading"
                    else -> "connecting_peers"
                }

                callback.onProgressUpdate(
                    currentBytes,
                    uploadedBytes.get(),
                    currentDownloadRate,
                    0,
                    seeds,
                    peers,
                    status
                )

                if (isFinished) {
                    callback.onFinished()
                    break
                }
            } catch (e: InterruptedException) {
                break
            } catch (e: Exception) {
                // Log and continue
            }
        }
    }

    private fun runTrackerAnnounceLoop() {
        val allTrackers = mutableListOf<String>()
        allTrackers.addAll(trackers.filter { it.isNotBlank() })
        for (defTr in DEFAULT_PUBLIC_TRACKERS) {
            if (!allTrackers.contains(defTr)) allTrackers.add(defTr)
        }

        while (isRunning.get() && !isPaused.get()) {
            val latch = CountDownLatch(allTrackers.size)
            for (trUrl in allTrackers) {
                if (!isRunning.get() || isPaused.get()) break
                executor.submit {
                    try {
                        when {
                            trUrl.startsWith("http://", ignoreCase = true) || trUrl.startsWith("https://", ignoreCase = true) -> {
                                announceHttpTracker(trUrl)
                            }
                            trUrl.startsWith("udp://", ignoreCase = true) -> {
                                announceUdpTracker(trUrl)
                            }
                        }
                    } catch (e: Exception) {
                        Log.d(TAG, "Tracker announce failed for $trUrl: ${e.message}")
                    } finally {
                        latch.countDown()
                    }
                }
            }

            try {
                latch.await(8, TimeUnit.SECONDS)
                Thread.sleep(25000)
            } catch (e: InterruptedException) {
                break
            }
        }
    }

    private fun announceHttpTracker(trackerUrl: String) {
        val encodedHash = StringBuilder()
        for (b in infoHashBytes) {
            encodedHash.append(String.format("%%%02X", b.toInt() and 0xFF))
        }

        val encodedPeerId = StringBuilder()
        for (b in peerIdBytes) {
            encodedPeerId.append(String.format("%%%02X", b.toInt() and 0xFF))
        }

        val left = (totalSize - downloadedBytes.get()).coerceAtLeast(0)
        val sep = if (trackerUrl.contains("?")) "&" else "?"
        val fullUrl = "$trackerUrl${sep}info_hash=$encodedHash&peer_id=$encodedPeerId&port=6881&uploaded=0&downloaded=${downloadedBytes.get()}&left=$left&compact=1&event=started"

        val conn = (URL(fullUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = SOCKET_TIMEOUT_MS
            readTimeout = SOCKET_TIMEOUT_MS
            requestMethod = "GET"
            setRequestProperty("User-Agent", "InpandTorrent/1.0.0 (Android)")
        }

        try {
            if (conn.responseCode == 200) {
                val bytes = conn.inputStream.use { it.readBytes() }
                parseTrackerResponseBytes(bytes)
            }
        } finally {
            conn.disconnect()
        }
    }

    private fun announceUdpTracker(trackerUrl: String) {
        val uri = URI(trackerUrl)
        val host = uri.host ?: return
        val port = if (uri.port > 0) uri.port else 1337

        val socket = DatagramSocket().apply {
            soTimeout = SOCKET_TIMEOUT_MS
        }

        try {
            val address = InetAddress.getByName(host)
            val connectionId = 0x41727101980L
            val transactionId = SecureRandom().nextInt()

            // 1. Connection Request (16 bytes)
            val connectReq = ByteBuffer.allocate(16).apply {
                order(ByteOrder.BIG_ENDIAN)
                putLong(connectionId)
                putInt(0) // Action 0: connect
                putInt(transactionId)
            }
            socket.send(DatagramPacket(connectReq.array(), 16, address, port))

            // 2. Connection Response (16 bytes)
            val connectRespBytes = ByteArray(16)
            val connectRespPacket = DatagramPacket(connectRespBytes, 16)
            socket.receive(connectRespPacket)

            val connectResp = ByteBuffer.wrap(connectRespBytes).apply { order(ByteOrder.BIG_ENDIAN) }
            val action = connectResp.getInt()
            val respTransId = connectResp.getInt()
            if (action != 0 || respTransId != transactionId) return
            val liveConnectionId = connectResp.getLong()

            // 3. Announce Request (98 bytes)
            val left = (totalSize - downloadedBytes.get()).coerceAtLeast(0)
            val announceTransId = SecureRandom().nextInt()
            val announceReq = ByteBuffer.allocate(98).apply {
                order(ByteOrder.BIG_ENDIAN)
                putLong(liveConnectionId)
                putInt(1) // Action 1: announce
                putInt(announceTransId)
                put(infoHashBytes)
                put(peerIdBytes)
                putLong(downloadedBytes.get())
                putLong(left)
                putLong(uploadedBytes.get())
                putInt(2) // Event 2: started
                putInt(0) // IP 0
                putInt(SecureRandom().nextInt()) // Key
                putInt(-1) // Num want
                putShort(6881.toShort()) // Port
            }
            socket.send(DatagramPacket(announceReq.array(), 98, address, port))

            // 4. Announce Response (minimum 20 bytes)
            val announceRespBytes = ByteArray(1024)
            val announceRespPacket = DatagramPacket(announceRespBytes, announceRespBytes.size)
            socket.receive(announceRespPacket)

            val len = announceRespPacket.length
            if (len >= 20) {
                val announceResp = ByteBuffer.wrap(announceRespBytes, 0, len).apply { order(ByteOrder.BIG_ENDIAN) }
                val aAction = announceResp.getInt()
                val aTransId = announceResp.getInt()
                if (aAction == 1 && aTransId == announceTransId) {
                    val interval = announceResp.getInt()
                    val leechers = announceResp.getInt()
                    val seeders = announceResp.getInt()
                    activeConnectedSeeds.set(seeders)

                    // Remaining bytes are compact peer IP:Port list (6 bytes each)
                    val peerOffset = 20
                    val peerBytesCount = len - peerOffset
                    val numPeersInResp = peerBytesCount / 6

                    for (i in 0 until numPeersInResp) {
                        val o = peerOffset + (i * 6)
                        val ip = "${announceRespBytes[o].toInt() and 0xFF}.${announceRespBytes[o + 1].toInt() and 0xFF}.${announceRespBytes[o + 2].toInt() and 0xFF}.${announceRespBytes[o + 3].toInt() and 0xFF}"
                        val p = ((announceRespBytes[o + 4].toInt() and 0xFF) shl 8) or (announceRespBytes[o + 5].toInt() and 0xFF)
                        if (p in 1..65535 && ip != "0.0.0.0") {
                            discoveredPeers.add("$ip:$p")
                        }
                    }
                    Log.i(TAG, "UDP tracker $host returned $numPeersInResp peers (seeders: $seeders)")
                }
            }
        } finally {
            socket.close()
        }
    }

    private fun parseTrackerResponseBytes(bytes: ByteArray) {
        val raw = String(bytes, Charsets.ISO_8859_1)

        // Parse compact peers binary string
        val peersKey = "5:peers"
        val idx = raw.indexOf(peersKey)
        if (idx != -1) {
            val colon = raw.indexOf(':', idx + peersKey.length)
            if (colon != -1) {
                val lenStr = raw.substring(idx + peersKey.length, colon)
                val len = lenStr.toIntOrNull() ?: 0
                val start = colon + 1
                if (start + len <= bytes.size) {
                    val count = len / 6
                    for (i in 0 until count) {
                        val o = start + (i * 6)
                        val ip = "${bytes[o].toInt() and 0xFF}.${bytes[o + 1].toInt() and 0xFF}.${bytes[o + 2].toInt() and 0xFF}.${bytes[o + 3].toInt() and 0xFF}"
                        val p = ((bytes[o + 4].toInt() and 0xFF) shl 8) or (bytes[o + 5].toInt() and 0xFF)
                        if (p in 1..65535 && ip != "0.0.0.0") {
                            discoveredPeers.add("$ip:$p")
                        }
                    }
                    Log.i(TAG, "HTTP tracker returned $count peers")
                }
            }
        }
    }

    private fun runPeerSwarmConnectorLoop() {
        while (isRunning.get() && !isPaused.get()) {
            while (connectedPeerSockets.size < MAX_ACTIVE_PEERS && discoveredPeers.isNotEmpty()) {
                val peerStr = discoveredPeers.firstOrNull() ?: break
                discoveredPeers.remove(peerStr)
                if (!connectedPeerSockets.containsKey(peerStr)) {
                    executor.submit { connectAndDownloadFromPeer(peerStr) }
                }
            }
            try {
                Thread.sleep(800)
            } catch (e: InterruptedException) {
                break
            }
        }
    }

    private fun connectAndDownloadFromPeer(peerStr: String) {
        val parts = peerStr.split(":")
        if (parts.size != 2) return
        val host = parts[0]
        val port = parts[1].toIntOrNull() ?: return

        var socket: Socket? = null
        try {
            socket = Socket()
            socket.connect(InetSocketAddress(host, port), SOCKET_TIMEOUT_MS)
            socket.soTimeout = 15000

            connectedPeerSockets[peerStr] = socket
            activeConnectedPeers.incrementAndGet()

            val outStream = DataOutputStream(BufferedOutputStream(socket.getOutputStream()))
            val inStream = DataInputStream(BufferedInputStream(socket.getInputStream()))

            // 1. Send Handshake (68 bytes)
            val handshake = ByteArray(68).apply {
                this[0] = 19
                System.arraycopy("BitTorrent protocol".toByteArray(Charsets.US_ASCII), 0, this, 1, 19)
                System.arraycopy(infoHashBytes, 0, this, 28, 20)
                System.arraycopy(peerIdBytes, 0, this, 48, 20)
            }
            outStream.write(handshake)
            outStream.flush()

            // 2. Read Peer Handshake Response (68 bytes)
            val peerHandshake = ByteArray(68)
            inStream.readFully(peerHandshake)

            // Validate info-hash
            for (i in 0 until 20) {
                if (peerHandshake[28 + i] != infoHashBytes[i]) {
                    Log.w(TAG, "Peer $peerStr handshake info-hash mismatch, disconnecting")
                    return
                }
            }

            // 3. Send 'interested' message (length 1, ID 2)
            outStream.writeInt(1)
            outStream.writeByte(2)
            outStream.flush()

            var isUnchoked = false
            var currentPieceIndex = 0

            // 4. Message loop
            while (isRunning.get() && !isPaused.get() && (totalSize <= 0L || downloadedBytes.get() < totalSize)) {
                val msgLength = inStream.readInt()
                if (msgLength == 0) continue // Keep-alive

                val msgId = inStream.readByte().toInt() and 0xFF
                val payloadLen = msgLength - 1

                when (msgId) {
                    0 -> isUnchoked = false // Choke
                    1 -> isUnchoked = true // Unchoke
                    4 -> inStream.skipBytes(payloadLen) // Have
                    5 -> inStream.skipBytes(payloadLen) // Bitfield
                    7 -> {
                        // Piece data message: [index (4), begin (4), block (N)]
                        if (payloadLen >= 8) {
                            val pIdx = inStream.readInt()
                            val begin = inStream.readInt()
                            val blockLen = payloadLen - 8
                            if (blockLen > 0) {
                                val blockBytes = ByteArray(blockLen)
                                inStream.readFully(blockBytes)

                                // Write to disk
                                val fileOffset = (pIdx.toLong() * pieceLength) + begin
                                synchronized(this) {
                                    randomAccessFile?.let { raf ->
                                        raf.seek(fileOffset)
                                        raf.write(blockBytes)
                                    }
                                }

                                downloadedBytes.addAndGet(blockLen.toLong())
                            }
                        } else {
                            inStream.skipBytes(payloadLen)
                        }
                    }
                    else -> inStream.skipBytes(payloadLen)
                }

                // If unchoked and we have data left to download, request next block
                if (isUnchoked && totalSize > 0 && downloadedBytes.get() < totalSize) {
                    val pIdx = (downloadedBytes.get() / pieceLength).toInt().coerceAtMost(numPieces - 1)
                    val begin = (downloadedBytes.get() % pieceLength).toInt()
                    val reqLen = BLOCK_SIZE.coerceAtMost((totalSize - downloadedBytes.get()).toInt())

                    if (reqLen > 0) {
                        // Request message: ID 6, len 13
                        outStream.writeInt(13)
                        outStream.writeByte(6)
                        outStream.writeInt(pIdx)
                        outStream.writeInt(begin)
                        outStream.writeInt(reqLen)
                        outStream.flush()
                    }
                }
            }
        } catch (e: Exception) {
            // Expected socket timeout or peer disconnect
        } finally {
            try {
                socket?.close()
            } catch (e: Exception) {
                // Ignore
            }
            connectedPeerSockets.remove(peerStr)
            activeConnectedPeers.decrementAndGet().coerceAtLeast(0)
        }
    }
}
