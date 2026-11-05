package com.torrentflow.mobile.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.torrentflow.mobile.torrent.TorrentManager

class ServiceActionReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "ServiceActionReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        Log.i(TAG, "Notification action received: $action")

        val manager = TorrentManager.getInstance(context)

        when (action) {
            TorrentDownloadService.ACTION_PAUSE_ALL -> {
                // Pause action handler
            }
            TorrentDownloadService.ACTION_RESUME_ALL -> {
                // Resume action handler
            }
            TorrentDownloadService.ACTION_STOP -> {
                val stopServiceIntent = Intent(context, TorrentDownloadService::class.java).apply {
                    this.action = TorrentDownloadService.ACTION_STOP
                }
                context.stopService(stopServiceIntent)
            }
        }
    }
}

