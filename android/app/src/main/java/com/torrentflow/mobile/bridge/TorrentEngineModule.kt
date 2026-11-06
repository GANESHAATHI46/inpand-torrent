package com.torrentflow.mobile.bridge

import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.torrentflow.mobile.torrent.TorrentIntentHandler
import com.torrentflow.mobile.torrent.TorrentManager
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

    override fun onTorrentStateUpdated(jsonState: String) {
        sendEvent("onTorrentStateUpdated", Arguments.createMap().apply {
            putString("stateJson", jsonState)
        })
    }

    override fun onTorrentFinished(infoHash: String) {
        sendEvent("onTorrentFinished", Arguments.createMap().apply {
            putString("infoHash", infoHash)
        })
    }

    override fun onMetadataReceived(infoHash: String, metadataJson: String) {
        sendEvent("onMetadataReceived", Arguments.createMap().apply {
            putString("infoHash", infoHash)
            putString("metadataJson", metadataJson)
        })
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
