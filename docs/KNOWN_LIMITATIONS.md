# Known Limitations and Platform Constraints

This document details known limitations, platform edge cases, and hardware-specific behaviors for **TorrentFlow Mobile**.

---

## 1. Android Scoped Storage & External SD Cards

- **Behavior**: On Android 11+ (API 30+), direct POSIX file path writing to removable physical micro-SD cards is restricted by Android Scoped Storage.
- **Handling**: TorrentFlow Mobile defaults to internal shared storage at `/storage/emulated/0/Download/TorrentFlow`. For custom folders on external SD cards, Android Storage Access Framework (SAF) URI tree delegation must be used.

---

## 2. Aggressive OEM Battery Management (Doze & App Standby)

- **Behavior**: Certain Android OEM skins (e.g. Xiaomi MIUI/HyperOS, Huawei EMUI, Samsung One UI) enforce aggressive background task termination beyond standard Android AOSP Doze behavior.
- **Mitigation**: TorrentFlow Mobile utilizes `PARTIAL_WAKE_LOCK` and `WifiLock`, and prompts users to set Battery Optimization to **Unrestricted** if sustained overnight transfers are requested.

---

## 3. Expo Go vs. Development Builds

- **Behavior**: Standard **Expo Go** client cannot load custom native C++ libraries or Android foreground services.
- **Handling**: TorrentFlow Mobile requires an Expo Development Build (`expo run:android` / `npx expo prebuild`) or release APK/AAB.

---

## 4. Local Build Environment Dependencies

- **Host Machine Constraint**: Building native Android C++ code locally requires JDK 17, Android SDK Command-line Tools, and Android NDK r25+.
- **Handling**: For developer machines lacking local Android NDK installations, EAS Build cloud compilation (`eas build --platform android`) or GitHub Actions CI/CD pipelines should be used to generate the final `.aab` artifacts.

---

## 5. ContentResolver vs. POSIX Filesystem Boundaries
- **Behavior**: External applications (Chrome, Gmail, WhatsApp, Telegram, SAF Document Pickers) provide `content://` URIs with transient read grants rather than POSIX filesystem paths.
- **Handling**: Native C++ BitTorrent engines (including libtorrent) cannot directly invoke `open()` or `stat()` on a `content://` URI string. TorrentFlow Mobile resolves all incoming content URIs via `ContentResolver.openInputStream()`, streams the payload safely into an application-controlled cache directory (`context.cacheDir/incoming_torrents/`), validates the bencode dictionary, and supplies valid descriptors to the native engine.

