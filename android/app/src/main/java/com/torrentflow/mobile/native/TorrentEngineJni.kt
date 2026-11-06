package com.torrentflow.mobile.native

import android.util.Log

/**
 * Kotlin JNI interface to native C++ libtorrent engine.
 */
object TorrentEngineJni {
    private const val TAG = "TorrentEngineJni"

    init {
        try {
            System.loadLibrary("torrentflow_native")
            Log.i(TAG, "Successfully loaded native library torrentflow_native")
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "Native library torrentflow_native not found in local runtime: ${e.message}")
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

    external fun nativeSetSpeedLimits(downloadLimit: Int, uploadLimit: Int): Boolean

    external fun nativePollAlerts(): String
}

