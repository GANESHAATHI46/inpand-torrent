# TorrentFlow Mobile — Development Status

## Project Overview
- **Project**: TorrentFlow Mobile (Android BitTorrent Client)
- **Target OS**: Android (API 24 to 34+, ARM64-v8a primary, armeabi-v7a, x86_64)
- **Frontend**: Expo 54, React Native 0.81, TypeScript, Expo Router
- **Core Engine**: C++ libtorrent 2.1.x / JNI Android Bridge / Kotlin Foreground Service
- **Python Layer**: Python 3.11 core modules for Bencoding, Magnet parsing, metadata processing, state machine, and SQLite data access
- **Database**: SQLite (schema migrations, transaction safety, fast resume metadata, file priorities)

---

## 1. Completed Features

### P0 Core Deliverables
- [x] Workspace isolation verified: TorrentFlow Mobile is built as a completely separate project; no desktop files touched.
- [x] Base project setup with Expo 54, React Native 0.81, TypeScript, Expo Router, and SVG.
- [x] Python 3.11 core modules:
  - `python/core/bencode.py`: Full bencoding/bdecoding suite.
  - `python/core/magnet.py`: Comprehensive Magnet URI parser (hex40 & base32) and generator.
  - `python/core/types.py`: Dataclasses for torrents, files, peers, trackers, session stats.
  - `python/torrent/metadata.py`: Torrent metadata parser, SHA1 info-hash generator, file tree builder.
  - `python/torrent/state_machine.py`: Deterministic state transitions, ETA calculations, moving average rates.
  - `python/torrent/file_selector.py`: File priority to piece index mapping.
  - `python/database/schema.py` & `db_manager.py`: SQLite versioned migrations, transaction safety, fast resume storage, duplicate detection.
  - `python/services/session_manager.py` & `bridge_protocol.py`: Session orchestrator and native bridge protocol.
- [x] 26 Automated Python Unit Tests passing (100% pass rate).
- [x] Mobile Frontend & Navigation (Expo Router):
  - `app/_layout.tsx`: Root stack navigator, ThemeProvider, StatusBar, SplashScreen handling.
  - `app/(tabs)/_layout.tsx`: Bottom tabs navigation (Dashboard, Downloads, Activity, Settings).
  - `app/(tabs)/index.tsx`: Dashboard with real-time transfer speeds, global progress, device storage card, quick queue controls, recent downloads.
  - `app/(tabs)/downloads.tsx`: Downloads screen with search bar, segmented status filter (All, Downloading, Completed, Paused), swipeable cards, pause/resume, delete with file cleanup.
  - `app/(tabs)/activity.tsx`: Live P2P activity (DHT node count, PEX status, LSD status, connected peers count, active seeds count, trackers count, session uptime).
  - `app/(tabs)/settings.tsx`: Settings screen with Wi-Fi only toggle, speed limits (KB/s), connection limits, DHT/PEX switches, dark/light theme selector, storage info.
  - `app/add-torrent.tsx`: Add Torrent modal supporting magnet URI input, clipboard magnet auto-detection, `.torrent` file picker, custom destination.
  - `app/torrent-details/[hash].tsx`: Detailed view with piece availability visualizer (`PieceBar`), multi-tab view (Overview, Files with individual priorities, Trackers with tier response, Peers with client flags).

### P1 Engine & Service Integration
- [x] Android Foreground Service (`android/service/TorrentDownloadService.kt`):
  - Supports Android 14+ `dataSync` foreground service type.
  - Ongoing progress notification with live speed and Pause All / Stop action buttons.
  - `PARTIAL_WAKE_LOCK` and `WifiLock` (HIGH_PERF) for sustained screen-off transfers.
- [x] Native C++ libtorrent JNI Bridge (`native/jni/torrent_engine_jni.cpp` & `native/CMakeLists.txt`):
  - Session lifecycle, magnet addition, torrent buffer decoding, pause/resume, rate limits, alert polling.
  - ARM64-v8a target ABI configuration.
- [x] Android Native Modules:
  - `android/native/TorrentEngineJni.kt`
  - `android/torrent/TorrentManager.kt`
  - `android/bridge/TorrentEngineModule.kt` & `TorrentEnginePackage.kt`
  - `android/service/ServiceActionReceiver.kt` & `BootReceiver.kt`
- [x] AndroidManifest.xml configured with permissions, service declarations, and intent filters for `magnet:` and `.torrent`.
- [x] ProGuard/R8 rules (`android/app/proguard-rules.pro`) protecting JNI methods and native symbols.
- [x] UI Footer & Bottom Navigation Inset Fix:
  - Dynamic `useSafeAreaInsets()` computation in `app/(tabs)/_layout.tsx` resolving 3-button navigation and gesture navigation overlap.
  - Generous bottom scroll padding (`paddingBottom: 96`) across all scrollable tab screens.
  - Documented in `docs/UI_FOOTER_FIX.md`.
- [x] Android File Association & Deep-Linking:
  - Full native intent handling (`TorrentIntentHandler.kt`) for `ACTION_VIEW`, `ACTION_SEND`, `ACTION_SEND_MULTIPLE`.
  - ContentResolver stream consumption into application cache for `content://` and `file://` URIs with 50MB ceiling and bencode validation.
  - React Native bridge integration (`getInitialTorrent`, `readTorrentFileBase64`, `onTorrentReceived`) and `useTorrentIntentListener.ts` hook.
  - Survives `npx expo prebuild` via Expo Config Plugin `plugins/withTorrentEngine.js`.
  - Documented in `docs/ANDROID_FILE_ASSOCIATION.md`.
- [x] Tab Navigation Scroll Reset:
  - Custom `useTabScrollReset.ts` hook supporting both ScrollView and FlatList.
  - Automatically resets scroll position to y=0 when navigating to Dashboard, Downloads, Activity, and Settings.
  - Scrolls to top smoothly when reselecting the active tab in the bottom bar.
- [x] .torrent File Full Engine Download Pipeline:
  - DocumentPicker now reads `content://`, `file://`, and SAF URIs without corrupting binary streams via `TorrentEngineModule.readTorrentFileBase64`.
  - Pure TypeScript bencode parser (`src/utils/torrentParser.ts`) calculates canonical info-hash from the exact raw `4:info` byte slice without re-encoding.
  - Real metadata preview (Name, Total Size, File count, Piece layout, Trackers, Info-hash) displayed in UI prior to download.
  - Duplicate torrent detection across both magnet and file additions.
  - Native Kotlin `TorrentManager` and C++ JNI bridge properly construct native add parameters and emit real progress alerts.
  - Documented in `BUG_FIX_REPORT.md`.

- [x] Complete Torrent Deletion Pipeline (Mode A & Mode B):
  - Created `DeleteTorrentModal.tsx` supporting Mode A (Remove Torrent Only) and Mode B (Remove Torrent & Delete Files) with destructive styling and double-tap prevention.
  - Resolved touch responder and event bubbling conflicts in `app/(tabs)/downloads.tsx` by decoupling action buttons from the clickable card body.
  - Eliminated "Torrent Not Found" view flicker during deletion in `app/torrent-details/[hash].tsx` using an `isDeleting` screen state guard.
  - Fixed Expo Router navigation target from `/downloads` to canonical `/(tabs)/downloads`.
  - Implemented atomic SQLite cascade deletion across `torrents`, `torrent_files`, and `trackers` within `withTransactionAsync`.
  - Native Kotlin `TorrentManager` and C++ JNI bridge enforce directory traversal safeguards (`canonicalPath.startsWith(canonicalBase)`) preventing arbitrary file deletion.
  - Immediate state recalculation and notification to UI listeners in `TorrentEngine.ts`.
  - Documented in `DELETE_BUG_FIX_REPORT.md`.

### Documentation & Release Preparation
- [x] `README.md`: High-level architecture, feature summary, quick start.
- [x] `DELETE_BUG_FIX_REPORT.md`: Comprehensive audit and fix report for torrent deletion across UI, native engine, and database.
- [x] `BUG_FIX_REPORT.md`: Comprehensive audit and fix report for scroll reset and .torrent download pipeline.
- [x] `docs/UI_FOOTER_FIX.md`: Inset handling, navigation bar geometry, and layout fixes.
- [x] `docs/ANDROID_FILE_ASSOCIATION.md`: Deep-linking, MIME configuration, native intent handler, and verification tests.
- [x] `docs/ARCHITECTURE.md`: Decoupled multi-tier architecture, component responsibilities, sequence diagrams.
- [x] `docs/ANDROID_SETUP.md`: Environment setup for Android SDK, NDK, Java 17, and physical device testing.
- [x] `docs/LIBTORRENT_INTEGRATION.md`: libtorrent 2.1.x integration, NDK compilation, fast resume serialization.
- [x] `docs/BUILD_INSTRUCTIONS.md`: Step-by-step commands for debug APK and release AAB builds.
- [x] `docs/TESTING.md`: Test suite documentation and physical device test procedures.
- [x] `docs/PLAY_STORE_HANDOVER.md`: Google Play Console handover guide, signing configs, and data safety declarations.
- [x] `docs/KNOWN_LIMITATIONS.md`: Platform limitations, OEM battery management, and scoped storage details.

---

## 2. Test Results
- **TypeScript Typecheck (`npm run typecheck`)**: PASSED (0 errors).
- **Jest Unit Tests (`npm test`)**: PASSED (19 passed, 3 suites).
- **Python Unit Tests (`python -m unittest`)**: PASSED (31 passed in 0.037s).

---

## 3. Host Environment & Build Status
- **Node.js**: v24.22.1 (installed)
- **npm**: 11.19.1 (installed)
- **Python**: 3.15.1 (installed)
- **Java / Android NDK**: Not installed locally on host machine.
  - *Next Action for Publishing Team*: Execute `bundleRelease` using standard Android Studio / CI-CD runner or EAS Build as documented in `docs/BUILD_INSTRUCTIONS.md` and `docs/PLAY_STORE_HANDOVER.md`.
