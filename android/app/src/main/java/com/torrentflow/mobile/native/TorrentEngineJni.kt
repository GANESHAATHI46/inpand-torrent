package com.torrentflow.mobile.native

import android.util.Log

/**
 * Kotlin JNI interface to native C++ libtorrent engine.
 */
object TorrentEngineJni {
    private const val TAG = "TorrentEngineJni"

    @Volatile
    var isLibraryLoaded: Boolean = false
        private set

    init {
        try {
            System.loadLibrary("torrentflow_native")
            isLibraryLoaded = true
            Log.i(TAG, "Successfully loaded native library 'torrentflow_native'")
        } catch (t: Throwable) {
            isLibraryLoaded = false
            Log.e(TAG, "Failed to load native library 'torrentflow_native': ${t.message}", t)
        }
    }

    external fun nativeInitSession(
        downloadLimit: Int,
        uploadLimit: Int,
        enableDht: Boolean,
        enablePex: Boolean,
        savePath: String
    ): Boolean

    external fun nativeAddMagnet(
        magnetUri: String,
        savePath: String
    ): String

    external fun nativeAddTorrentFile(
        fileBytes: ByteArray,
        savePath: String
    ): String

    external fun nativePauseTorrent(infoHash: String): Boolean

    external fun nativeResumeTorrent(infoHash: String): Boolean

    external fun nativeRemoveTorrent(infoHash: String, deleteFiles: Boolean): Boolean

    external fun nativeRestoreTorrent(
        infoHash: String,
        name: String,
        savePath: String,
        totalSize: Long,
        downloadedBytes: Long,
        status: String
    ): Boolean

    external fun nativeSetSpeedLimits(downloadLimit: Int, uploadLimit: Int): Boolean

    external fun nativePollAlerts(): String
}
