package com.torrentflow.mobile.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.torrentflow.mobile.torrent.TorrentManager

class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i(TAG, "Device booted, initializing TorrentFlow Mobile session")
            try {
                val manager = TorrentManager.getInstance(context)
                manager.initSession()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restore torrent session on boot: ${e.message}")
            }
        }
    }
}

