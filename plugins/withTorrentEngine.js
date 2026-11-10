const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withMainActivity, withDangerousMod } = require('expo/config-plugins');

function withTorrentEngine(config) {
  // 1. Android Manifest modifications
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // --- Services ---
    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    const hasService = mainApplication.service.some(
      (s) => s.$['android:name'] === '.service.TorrentDownloadService'
    );
    if (!hasService) {
      mainApplication.service.push({
        $: {
          'android:name': '.service.TorrentDownloadService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    // --- Receivers ---
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    const hasActionReceiver = mainApplication.receiver.some(
      (r) => r.$['android:name'] === '.service.ServiceActionReceiver'
    );
    if (!hasActionReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.service.ServiceActionReceiver',
          'android:exported': 'false',
        },
      });
    }

    const hasBootReceiver = mainApplication.receiver.some(
      (r) => r.$['android:name'] === '.service.BootReceiver'
    );
    if (!hasBootReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.service.BootReceiver',
          'android:enabled': 'true',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.BOOT_COMPLETED',
                },
              },
            ],
          },
        ],
      });
    }

    // --- MainActivity Intent Filters ---
    const mainActivity = mainApplication.activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }

      // Helper to avoid duplicate intent-filter declarations
      const filters = mainActivity['intent-filter'];

      // A. Magnet Links (ACTION_VIEW)
      const hasMagnetFilter = filters.some((f) =>
        f.data?.some((d) => d.$?.['android:scheme'] === 'magnet')
      );
      if (!hasMagnetFilter) {
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [{ $: { 'android:scheme': 'magnet' } }],
        });
      }

      // B. .torrent MIME Types (ACTION_VIEW)
      const hasMimeFilter = filters.some((f) =>
        f.data?.some((d) => d.$?.['android:mimeType'] === 'application/x-bittorrent')
      );
      if (!hasMimeFilter) {
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [
            { $: { 'android:scheme': 'content' } },
            { $: { 'android:scheme': 'file' } },
            { $: { 'android:mimeType': 'application/x-bittorrent' } },
            { $: { 'android:mimeType': 'application/x-torrent' } },
            { $: { 'android:mimeType': 'application/torrent' } },
          ],
        });
      }

      // C. .torrent file extension / octet-stream pathPattern matching
      const hasPatternFilter = filters.some((f) =>
        f.data?.some((d) => d.$?.['android:pathPattern'] === '.*\\.torrent')
      );
      if (!hasPatternFilter) {
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [
            { $: { 'android:scheme': 'content' } },
            { $: { 'android:scheme': 'file' } },
            { $: { 'android:host': '*' } },
            { $: { 'android:pathPattern': '.*\\.torrent' } },
            { $: { 'android:mimeType': '*/*' } },
          ],
        });
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [
            { $: { 'android:scheme': 'content' } },
            { $: { 'android:scheme': 'file' } },
            { $: { 'android:host': '*' } },
            { $: { 'android:pathPattern': '.*\\.torrent' } },
            { $: { 'android:mimeType': 'application/octet-stream' } },
          ],
        });
      }

      // D. ACTION_SEND (Share single .torrent / magnet to TorrentFlow)
      const hasSendFilter = filters.some((f) =>
        f.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND')
      );
      if (!hasSendFilter) {
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          data: [
            { $: { 'android:mimeType': 'application/x-bittorrent' } },
            { $: { 'android:mimeType': 'application/x-torrent' } },
            { $: { 'android:mimeType': 'application/torrent' } },
            { $: { 'android:mimeType': 'application/octet-stream' } },
            { $: { 'android:mimeType': 'text/plain' } },
          ],
        });
      }

      // E. ACTION_SEND_MULTIPLE (Share multiple torrents)
      const hasSendMultiFilter = filters.some((f) =>
        f.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND_MULTIPLE')
      );
      if (!hasSendMultiFilter) {
        filters.push({
          action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          data: [
            { $: { 'android:mimeType': 'application/x-bittorrent' } },
            { $: { 'android:mimeType': 'application/x-torrent' } },
            { $: { 'android:mimeType': 'application/torrent' } },
            { $: { 'android:mimeType': 'application/octet-stream' } },
          ],
        });
      }
    }

    return config;
  });

  // 2. MainActivity.kt modifications
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add imports if missing
    if (!contents.includes('import com.torrentflow.mobile.torrent.TorrentIntentHandler')) {
      contents = contents.replace(
        /package com\.torrentflow\.mobile\s*/,
        `package com.torrentflow.mobile\nimport android.content.Intent\nimport com.torrentflow.mobile.torrent.TorrentIntentHandler\n`
      );
    }

    // Ensure onCreate handles initial intent
    if (!contents.includes('TorrentIntentHandler.handleIntent')) {
      contents = contents.replace(
        /super\.onCreate\(null\)/,
        `super.onCreate(null)\n    intent?.let { TorrentIntentHandler.handleIntent(it, this) }`
      );
    }

    // Ensure onNewIntent is implemented
    if (!contents.includes('override fun onNewIntent')) {
      const onNewIntentSnippet = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    TorrentIntentHandler.handleIntent(intent, this)
  }
`;
      // Insert before closing brace of class
      const lastIndex = contents.lastIndexOf('}');
      if (lastIndex !== -1) {
        contents = contents.slice(0, lastIndex) + onNewIntentSnippet + contents.slice(lastIndex);
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  // 3. Ensure no duplicate launcher icon PNGs exist alongside WEBP icons in mipmap folders
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
      const pngNames = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
      for (const m of mipmaps) {
        for (const p of pngNames) {
          const filePath = path.join(resDir, m, p);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (_) {}
          }
        }
      }
      return config;
    },
  ]);

  return config;
}

module.exports = withTorrentEngine;
