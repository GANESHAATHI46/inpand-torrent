# TorrentFlow Mobile — Android File Association & Deep-Linking

## 1. Overview
TorrentFlow Mobile supports deep-link associations and native file handling for `.torrent` files and `magnet:` links across Android 8 through Android 15/16.

Supported file inputs and sources:
- **MIME Types**: `application/x-bittorrent`, `application/x-torrent`, `application/torrent`, `application/octet-stream` (when extension is `.torrent`).
- **URI Schemes**: `content://` and `file://`.
- **Sources Tested**: Android Files app, Chrome downloads, Telegram documents, WhatsApp documents, and third-party file managers.
- **Intents Handled**: `ACTION_VIEW`, `ACTION_SEND` (share single), and `ACTION_SEND_MULTIPLE` (share batch).

---

## 2. Intent Filter Configuration (`plugins/withTorrentEngine.js`)

All intent filters are managed through an Expo Config Plugin to guarantee persistence across `npx expo prebuild`.

```javascript
// plugins/withTorrentEngine.js
// Injected into AndroidManifest.xml under .MainActivity:

// 1. Magnet links
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="magnet" />
</intent-filter>

// 2. MIME type view (.torrent files)
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:mimeType="application/x-bittorrent" />
</intent-filter>

// 3. Fallback wildcard extension matching for content:// and file://
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="content" />
  <data android:scheme="file" />
  <data android:host="*" />
  <data android:pathPattern=".*\\.torrent" />
  <data android:mimeType="*/*" />
</intent-filter>

// 4. Share single torrent (ACTION_SEND)
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="application/x-bittorrent" />
  <data android:mimeType="application/x-torrent" />
  <data android:mimeType="application/torrent" />
  <data android:mimeType="application/octet-stream" />
  <data android:mimeType="text/plain" />
</intent-filter>

// 5. Share multiple torrents (ACTION_SEND_MULTIPLE)
<intent-filter>
  <action android:name="android.intent.action.SEND_MULTIPLE" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="application/x-bittorrent" />
  <data android:mimeType="application/x-torrent" />
  <data android:mimeType="application/torrent" />
  <data android:mimeType="application/octet-stream" />
</intent-filter>
```

---

## 3. Native Intent Handler (`TorrentIntentHandler.kt`)

### Key Architecture Decisions:
1. **Never Assume `content://` is a Filesystem Path**:
   External providers (WhatsApp, Chrome, Telegram) do not provide real filesystem paths. The handler accesses the stream via `context.contentResolver.openInputStream(uri)`.
2. **Safe App Cache Streaming**:
   Incoming torrent streams are copied in 8KB chunks into `context.cacheDir/incoming_torrents/` with a 50MB ceiling to prevent out-of-memory errors.
3. **Filename Resolution & Sanitization**:
   Filename is resolved from `OpenableColumns.DISPLAY_NAME`. Any illegal characters are sanitized while preserving unicode characters and spaces.
4. **Bencode Header Validation**:
   The copied file is verified prior to dispatch:
   - Size >= 20 bytes and <= 50MB.
   - First byte matches `'d'` (`0x64`).
   - Header contains the `"info"` or `"4:info"` bencode dictionary key.
   If validation fails, the temporary file is deleted and no invalid state reaches React Native.
5. **Debouncing & Duplicate Prevention**:
   Intents received within 1500ms for the same URI are ignored to prevent double-firing from activity re-creation.
6. **Cold-Start vs Runtime Delivery**:
   - If React Native is not ready (`listener == null`), the payload is held in `pendingInitialTorrent`.
   - Once initialized, `TorrentEngineModule.getInitialTorrent()` retrieves and clears the pending payload.
   - If the app is already in the foreground or background, `onNewIntent` streams the event directly to `onTorrentReceived`.

---

## 4. React Native Integration

### Flow Architecture:
1. **`MainActivity.kt`**:
   - `onCreate`: Passes `intent` to `TorrentIntentHandler.handleIntent(intent, this)`.
   - `onNewIntent`: Passes runtime `intent` to `TorrentIntentHandler.handleIntent(intent, this)`.
2. **`TorrentEngineModule.kt`**:
   - Registers callback with `TorrentIntentHandler`.
   - Exposes `@ReactMethod getInitialTorrent(promise)`.
   - Exposes `@ReactMethod readTorrentFileBase64(filePath, promise)`.
   - Emits `'onTorrentReceived'` event to React Native.
3. **`useTorrentIntentListener.ts` Hook**:
   - Mounted globally at root in `app/_layout.tsx`.
   - Inspects `getInitialTorrent()` on launch.
   - Subscribes to `onTorrentReceived` and `Linking` events.
   - Checks if the torrent is already active in `TorrentEngine`.
     - **If duplicate**: Displays a notice and routes the user to `torrent-details/[hash]`.
     - **If new**: Queues the torrent and routes the user to `torrent-details/[hash]`.
     - **If corrupted**: Displays a clear error dialog.

---

## 5. Verification Commands (ADB)

To verify intent handling on an Android emulator or connected device:

### A. Test Magnet URI (ACTION_VIEW)
```bash
adb shell am start -a android.intent.action.VIEW \
  -d "magnet:?xt=urn:btih:3b245504cf5f11bbdbe1201cea6a6bf45a0b7758&dn=Ubuntu_24_04_LTS" \
  com.torrentflow.mobile
```

### B. Test .torrent File from Content Provider (ACTION_VIEW)
```bash
# Push sample file to device storage
adb push test.torrent /sdcard/Download/test.torrent

# Trigger view intent
adb shell am start -a android.intent.action.VIEW \
  -d "file:///sdcard/Download/test.torrent" \
  -t "application/x-bittorrent" \
  com.torrentflow.mobile
```

### C. Test Share-To-App (ACTION_SEND)
```bash
adb shell am start -a android.intent.action.SEND \
  -t "application/x-bittorrent" \
  --eu android.intent.extra.STREAM "file:///sdcard/Download/test.torrent" \
  com.torrentflow.mobile
```

