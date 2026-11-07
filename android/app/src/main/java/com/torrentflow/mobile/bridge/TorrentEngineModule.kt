package com.torrentflow.mobile.bridge

import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.torrentflow.mobile.torrent.TorrentIntentHandler
import com.torrentflow.mobile.torrent.TorrentManager
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

class TorrentEngineModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TorrentManager.AlertListener {

    private val manager: TorrentManager by lazy {
        TorrentManager.getInstance(reactContext)
    }

    override fun getName(): String = "TorrentEngineModule"

    override fun initialize() {
        super.initialize()
        manager.registerListener(this)

        // Connect intent handler to emit live events to React Native
        TorrentIntentHandler.setListener { payload ->
            sendEvent("onTorrentReceived", payload)
        }
    }

    override fun invalidate() {
        manager.unregisterListener(this)
        TorrentIntentHandler.setListener(null)
        super.invalidate()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep for React Native NativeEventEmitter compatibility
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep for React Native NativeEventEmitter compatibility
    }

    @ReactMethod
    fun getInitialTorrent(promise: Promise) {
        try {
            val initial = TorrentIntentHandler.getInitialTorrent()
            promise.resolve(initial)
        } catch (e: Exception) {
            promise.reject("GET_INITIAL_TORRENT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun readTorrentFileBase64(uriString: String, promise: Promise) {
        try {
            val bytes: ByteArray
            if (uriString.startsWith("content://")) {
                val uri = android.net.Uri.parse(uriString)
                val inputStream = reactContext.contentResolver.openInputStream(uri)
                    ?: run {
                        promise.reject("FILE_NOT_FOUND", "Cannot open stream for content URI: $uriString")
                        return
                    }
                bytes = inputStream.use { it.readBytes() }
            } else {
                val cleanPath = uriString.removePrefix("file://")
                val file = File(cleanPath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Torrent file does not exist at path: $uriString")
                    return
                }
                bytes = file.readBytes()
            }

            if (bytes.size > 50 * 1024 * 1024) {
                promise.reject("FILE_TOO_LARGE", "Torrent file exceeds maximum allowed size of 50MB")
                return
            }

            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            promise.resolve(base64)
        } catch (e: Exception) {
            promise.reject("READ_ERROR", "Error reading file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun initializeSession(promise: Promise) {
        try {
            val success = manager.initSession()
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addMagnet(magnetUri: String, savePath: String, promise: Promise) {
        try {
            val hash = manager.addMagnet(magnetUri, savePath)
            if (hash.isNotEmpty()) {
                val map = Arguments.createMap().apply {
                    putString("infoHash", hash)
                    putString("status", "downloading_metadata")
                }
                promise.resolve(map)
            } else {
                promise.reject("ADD_MAGNET_FAILED", "Failed to add magnet URI")
            }
        } catch (e: Exception) {
            promise.reject("ADD_MAGNET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addTorrentFile(fileBytesBase64: String, savePath: String, promise: Promise) {
        try {
            val bytes = Base64.decode(fileBytesBase64, Base64.DEFAULT)
            val meta = manager.addTorrentFile(bytes, savePath)
            val map = Arguments.createMap().apply {
                putString("infoHash", meta.infoHash)
                putString("name", meta.name)
                putDouble("totalSize", meta.totalSize.toDouble())
                putInt("pieceLength", meta.pieceLength)
                putInt("numPieces", meta.numPieces)
                putString("status", "downloading")
                putString("savePath", savePath)

                val filesArr = Arguments.createArray()
                for (f in meta.files) {
                    filesArr.pushMap(Arguments.createMap().apply {
                        putInt("index", f.index)
                        putString("path", f.path)
                        putDouble("size", f.size.toDouble())
                        putDouble("offset", f.offset.toDouble())
                        putInt("priority", 4)
                        putDouble("downloadedBytes", 0.0)
                        putDouble("progress", 0.0)
                    })
                }
                putArray("files", filesArr)

                val trackersArr = Arguments.createArray()
                for (t in meta.trackers) {
                    trackersArr.pushString(t)
                }
                putArray("trackers", trackersArr)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ADD_FILE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun pauseTorrent(infoHash: String, promise: Promise) {
        try {
            val success = manager.pauseTorrent(infoHash)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun resumeTorrent(infoHash: String, promise: Promise) {
        try {
            val success = manager.resumeTorrent(infoHash)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun removeTorrent(infoHash: String, deleteFiles: Boolean, promise: Promise) {
        try {
            val success = manager.removeTorrent(infoHash, deleteFiles)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("REMOVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun restoreTorrent(
        infoHash: String,
        name: String,
        savePath: String,
        totalSize: Double,
        downloadedBytes: Double,
        status: String,
        promise: Promise
    ) {
        try {
            val success = manager.restoreTorrent(
                infoHash = infoHash,
                name = name,
                savePath = savePath,
                totalSize = totalSize.toLong(),
                downloadedBytes = downloadedBytes.toLong(),
                status = status
            )
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("RESTORE_ERROR", e.message, e)
        }
    }

    override fun onTorrentStateUpdated(jsonState: String) {
        try {
            val obj = JSONObject(jsonState)
            val map = Arguments.createMap().apply {
                putString("stateJson", jsonState)
                val h = obj.optString("infoHash", obj.optString("info_hash"))
                putString("infoHash", h)
                putDouble("downloadedBytes", obj.optDouble("downloadedBytes", obj.optDouble("downloaded_bytes", 0.0)))
                putDouble("uploadedBytes", obj.optDouble("uploadedBytes", obj.optDouble("uploaded_bytes", 0.0)))
                putInt("downloadRate", obj.optInt("downloadRate", obj.optInt("download_rate", 0)))
                putInt("uploadRate", obj.optInt("uploadRate", obj.optInt("upload_rate", 0)))
                putInt("numSeeds", obj.optInt("numSeeds", obj.optInt("num_seeds", 0)))
                putInt("numPeers", obj.optInt("numPeers", obj.optInt("num_peers", 0)))
                putInt("totalSeeds", obj.optInt("totalSeeds", obj.optInt("total_seeds", 0)))
                putInt("totalPeers", obj.optInt("totalPeers", obj.optInt("total_peers", 0)))
                if (obj.has("status")) {
                    putString("status", obj.optString("status"))
                }
            }
            sendEvent("onTorrentStateUpdated", map)
        } catch (e: Exception) {
            sendEvent("onTorrentStateUpdated", Arguments.createMap().apply {
                putString("stateJson", jsonState)
            })
        }
    }

    override fun onTorrentFinished(infoHash: String) {
        sendEvent("onTorrentFinished", Arguments.createMap().apply {
            putString("infoHash", infoHash)
        })
    }

    override fun onMetadataReceived(infoHash: String, metadataJson: String) {
        try {
            val obj = JSONObject(metadataJson)
            val map = Arguments.createMap().apply {
                putString("infoHash", infoHash)
                putString("metadataJson", metadataJson)
                putString("name", obj.optString("name"))
                putDouble("totalSize", obj.optDouble("totalSize", obj.optDouble("total_size", 0.0)))
                putInt("pieceLength", obj.optInt("pieceLength", obj.optInt("piece_length", 0)))
                putInt("numPieces", obj.optInt("numPieces", obj.optInt("num_pieces", 0)))
            }
            sendEvent("onMetadataReceived", map)
        } catch (e: Exception) {
            sendEvent("onMetadataReceived", Arguments.createMap().apply {
                putString("infoHash", infoHash)
                putString("metadataJson", metadataJson)
            })
        }
    }

    override fun onTorrentError(infoHash: String, message: String) {
        sendEvent("onTorrentError", Arguments.createMap().apply {
            putString("infoHash", infoHash)
            putString("errorMessage", message)
        })
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }
}
