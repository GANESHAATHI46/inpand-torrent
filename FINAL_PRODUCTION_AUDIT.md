# FINAL PRODUCTION AUDIT — TORRENTFLOW MOBILE

**Audit Date**: November 5, 2026  
**Audited Directory**: `D:\github\torrentflow-mobile`  
**Auditor**: Senior Android Engineer, React Native Architect, and Native C++ BitTorrent Engineer  

---

## EXECUTIVE SUMMARY

TorrentFlow Mobile was subjected to an exhaustive technical audit across all architectural layers: React Native/Expo UI, Python 3.11 modules, Native Android Kotlin services, C++ libtorrent JNI bridge, build configurations, and physical hardware requirements.

### Final Readiness Classification:
🔴 **NOT BUILDABLE (Locally on this Host Machine)** / 🟡 **BUILDABLE BUT NOT FUNCTIONALLY VERIFIED (Architecture & Scaffolding Level)**

> **Honest Engineering Assessment**:  
> The application has a functional, completely typed, and well-designed React Native / Expo Router frontend with SQLite persistence, unit test suites, and Kotlin background foreground service source code.  
> **However, it CANNOT currently perform real BitTorrent transfers on Android**, because:
> 1. No compiled `libtorrent-rasterbar.so` or `libtorrentflow_native.so` binary exists in `android/app/src/main/jniLibs/`.
> 2. The native C++ JNI code (`torrent_engine_jni.cpp`) is currently a bridge scaffolding stub that returns mock responses rather than calling active `libtorrent::session` APIs.
> 3. The Python 3.11 modules are standalone host scripts not embedded into the Android APK runtime (no Chaquopy or embedded CPython bridge exists).
> 4. Java JDK 17+ and Android NDK are not installed in the host's system PATH, preventing local compilation of APK/AAB build artifacts without cloud build infrastructure.

---

## 1. NATIVE ENGINE VERIFICATION

| Check Item | Status | Detailed Finding |
|---|---|---|
| **libtorrent 2.1.x Source** | ❌ **MISSING** | `native/libtorrent/` contains a shell build script (`build_libtorrent_android.sh`), but the actual C++ libtorrent repository (`git clone https://github.com/arvidn/libtorrent`) and Boost/OpenSSL headers are **not present** on disk. |
| **Android .so Libraries** | ❌ **MISSING** | No `.so` binaries exist in `android/app/src/main/jniLibs/` or `native/prebuilts/` for `arm64-v8a`, `armeabi-v7a`, or `x86_64`. |
| **Packaging into Application** | ❌ **NOT PACKAGED** | Because no `.so` files exist on disk, no native BitTorrent shared libraries are currently packaged into APK/AAB artifacts. |
| **JNI Methods Alignment** | ⚠️ **PARTIALLY MATCHED (STUB)** | Function signatures in `native/jni/torrent_engine_jni.cpp` (`Java_com_torrentflow_mobile_native_TorrentEngineJni_*`) match Kotlin `TorrentEngineJni.kt`. However, `torrent_engine_jni.cpp` uses a mock placeholder struct (`NativeTorrentSession`). `nativePollAlerts` returns hardcoded `"[]"`, and `nativeAddMagnet` only parses a string candidate without calling `libtorrent::session::async_add_torrent`. |
| **Native Session Initialization** | ⚠️ **SCAFFOLDING ONLY** | Session configuration is recorded in memory in C++, but real libtorrent session objects (`lt::session`, `lt::settings_pack`) are not instantiated. |
| **Magnet URI Handling** | ⚠️ **SCAFFOLDING ONLY** | Reaches C++ JNI string parsing, but does NOT contact DHT nodes or trackers. In React Native (`TorrentEngine.ts`), a simulated fallback object is returned when the native module is absent. |
| **Alerts & Statistics to React Native** | ❌ **NOT FUNCTIONAL** | Because `nativePollAlerts` returns `[]`, no real BitTorrent alerts (`state_update_alert`, `metadata_received_alert`, `torrent_finished_alert`) reach Kotlin or React Native. |

---

## 2. PYTHON INTEGRATION VERIFICATION

| Check Item | Status | Detailed Finding |
|---|---|---|
| **Python 3.11 Packaged in Android** | ❌ **NOT PACKAGED** | There is **no Chaquopy plugin**, no Python-for-Android runtime, and no embedded `libpython3.11.so` configured in `android/build.gradle` or `android/app/build.gradle`. |
| **Python Executable on Android** | ❌ **NO** | Python code cannot execute on Android without an embedded runtime. Python 3.15.1 is only available on the developer host machine. |
| **Python ↔ Kotlin ↔ React Native Communication** | ❌ **DISCONNECTED** | There is **no IPC, RPC, or JNI bridge** connecting the Python modules to Kotlin or React Native. The Python layer exists solely as standalone host scripts. |
| **Standalone / Unused Python Modules** | ⚠️ **IDENTIFIED** | The entire `python/` directory (`core/bencode.py`, `core/magnet.py`, `torrent/metadata.py`, `torrent/state_machine.py`, `torrent/file_selector.py`, `services/session_manager.py`) is standalone. React Native reimplements its own logic in TypeScript (`src/services/TorrentEngine.ts`, `src/utils/formatters.ts`). |
| **Duplicate Database Implementations** | ⚠️ **IDENTIFIED** | Two independent, disconnected SQLite implementations exist: <br>1. `python/database/schema.py` & `db_manager.py` (Python SQLite, used only by Python unit tests). <br>2. `src/services/DatabaseService.ts` (TypeScript `expo-sqlite`, used by the React Native UI). |

---

## 3. REAL TORRENT TESTING VERIFICATION

| Operation | Real Engine Status | Evidence & Verification Result |
|---|---|---|
| **Magnet URI Handling** | ⚠️ Standalone Only | Validated in Python tests (`test_magnet.py`), but does not initiate P2P connections on device. |
| **Metadata Retrieval** | ❌ Not Functional | Cannot exchange metadata with BitTorrent swarm (no socket/DHT engine running). |
| **Peer Discovery (P2P)** | ❌ Not Functional | Cannot send tracker announces or peer handshakes. |
| **Distributed Hash Table (DHT)** | ❌ Not Functional | Mainline DHT nodes cannot be queried. |
| **Piece Downloading** | ❌ Not Functional | No byte chunk downloads occur. |
| **Piece Verification (SHA-1)** | ⚠️ Python Only | SHA-1 verification is implemented and passing in Python unit tests, but not in native runtime. |
| **File Writing** | ❌ Not Functional | Disk allocation and piece flushing to Android storage are not connected to native engine. |
| **Pause & Resume** | ⚠️ UI / DB Only | State toggles in UI and SQLite, but no native swarm disconnect/reconnect occurs. |
| **Seeding** | ❌ Not Functional | No seeding occurs. |
| **Fast Resume** | ⚠️ DB Schema Only | BLOB storage tested in SQLite unit test, but no libtorrent fast resume data generated. |

---

## 4. ANDROID BACKGROUND & FOREGROUND SERVICE TESTING

| Check Item | Status | Verification Detail |
|---|---|---|
| **Foreground Service Registration** | ✅ **CONFIGURED** | `TorrentDownloadService` is declared in `android/app/src/main/AndroidManifest.xml` and protected via `./plugins/withTorrentEngine.js`. |
| **Foreground Service Type** | ✅ **CORRECT** | Declared with `android:foregroundServiceType="dataSync"`. |
| **Foreground Service Permissions** | ✅ **DECLARED** | `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_DATA_SYNC` are present in `AndroidManifest.xml`. |
| **Notification Actions** | ✅ **IMPLEMENTED** | `TorrentDownloadService.kt` builds `NotificationCompat.Builder` with Pause All and Stop PendingIntents routed to `ServiceActionReceiver.kt`. |
| **WakeLock & WifiLock** | ✅ **IMPLEMENTED** | Acquires `PowerManager.PARTIAL_WAKE_LOCK` and `WifiManager.WIFI_MODE_FULL_HIGH_PERF`. |
| **Android 14 Compatibility** | ✅ **COMPATIBLE** | Correctly targets API 34 with `POST_NOTIFICATIONS` runtime permission and `dataSync` service type. |
| **Android 15 Compatibility (6-Hour Limit)** | ⚠️ **CRITICAL LIMITATION** | **Android 15 (API 35) introduces a strict 6-hour execution timeout for `dataSync` foreground services** within a 24-hour period when the app is in the background. Long-running torrent downloads or seeding will be forcibly stopped by Android 15 unless the app is brought to the foreground or exempted via battery optimization settings. |
| **Android 16 Compatibility** | ⚠️ **PENDING** | Expo SDK 54 / AGP 8.2 does not yet officially support API 36 compilation (requires Expo SDK 55/56). |
| **App Process Termination** | ⚠️ **PARTIAL** | `BootReceiver.kt` listens for `ACTION_BOOT_COMPLETED`, but cannot restore native C++ downloads until the native engine is linked. |

---

## 5. GOOGLE PLAY RELEASE AUDIT

| Criteria | Status | Audit Findings |
|---|---|---|
| **Current Target SDK Requirement** | ✅ Compliant | Targets API 34 / 35. Meets current Google Play minimum (API 34). |
| **Expo SDK 54 Compatibility** | ✅ Compatible | Built on React Native 0.81.5 and Expo 54.0.35. |
| **Gradle / AGP Version** | ✅ Compatible | AGP 8.2.1 and Gradle 8.2+ supported. |
| **ARM64 Native Requirement** | ❌ **FAIL** | Google Play **strictly requires 64-bit native code (`arm64-v8a`)** for any app with native dependencies. Currently, no `.so` files exist. |
| **Release Signing Configuration** | ✅ Configured | `android/app/build.gradle` dynamically reads `TORRENTFLOW_RELEASE_STORE_FILE`, `TORRENTFLOW_RELEASE_STORE_PASSWORD`, `TORRENTFLOW_RELEASE_KEY_ALIAS`, and `TORRENTFLOW_RELEASE_KEY_PASSWORD` from environment variables without hardcoded secrets. |
| **bundleRelease Task** | ⚠️ Configured but Unbuilt | Gradle task `bundleRelease` exists in `build.gradle`, but cannot run locally due to missing JDK. |
| **Play Store Policy Declarations** | ⚠️ Action Required | Publishing team must submit **Foreground Service Declaration (`dataSync`)** with a demo video to Google Play Console prior to approval. |

---

## 6. ACTUAL BUILD VERIFICATION LOGS

### 1. `npm install`
- **Command**: `npm install`
- **Exit Code**: `0` (Success)
- **Log**: `up to date in 2s, 1128 packages audited`

### 2. `npx tsc --noEmit` (TypeScript Typecheck)
- **Command**: `npx tsc --noEmit`
- **Exit Code**: `0` (Success)
- **Log**: `0 errors across all .ts and .tsx files`

### 3. `npm test` (Jest Unit Tests)
- **Command**: `npm test`
- **Exit Code**: `0` (Success)
- **Log**:
  ```
  PASS tests/jest/formatters.test.ts
  Test Suites: 1 passed, 1 total
  Tests:       7 passed, 7 total
  Snapshots:   0 total
  Time:        1.772 s
  ```

### 4. Python Unit Test Suite
- **Command**: `python -m unittest discover -s tests/python -p "test_*.py"`
- **Exit Code**: `0` (Success)
- **Log**:
  ```
  ..........................
  Ran 26 tests in 0.007s
  OK
  ```

### 5. `npx expo prebuild --platform android`
- **Command**: `npx expo prebuild --platform android --no-install`
- **Exit Code**: `0` (Success)
- **Log**:
  ```
  - Creating native directory (./android)
  √ Finished prebuild
  ```

### 6. Android Gradle Debug Build (`assembleDebug`)
- **Command**: `cd android && .\gradlew.bat assembleDebug`
- **Exit Code**: `1` (Failed)
- **Error Log**:
  ```
  ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
  Please set the JAVA_HOME variable in your environment to match the location of your Java installation.
  ```

### 7. Android Gradle Release AAB Build (`bundleRelease`)
- **Command**: `cd android && .\gradlew.bat bundleRelease`
- **Exit Code**: `1` (Failed)
- **Error Log**:
  ```
  ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
  ```

---

## 7. CRITICAL BLOCKERS

### Blocker 1: Missing Host JDK and Android SDK
- **Problem**: `java` and `javac` are not present on the host system. Local Gradle builds cannot execute.
- **Impact**: Neither `assembleDebug` nor `bundleRelease` can be built locally on this Windows machine.

### Blocker 2: Missing Compiled libtorrent 2.1.x Native Libraries
- **Problem**: No compiled `libtorrent-rasterbar.so` or `libtorrentflow_native.so` binary exists for `arm64-v8a`.
- **Impact**: The app cannot perform peer-to-peer torrent connections, metadata exchanges, or piece downloads.

### Blocker 3: JNI Bridge is a Mock Scaffolding Stub
- **Problem**: `native/jni/torrent_engine_jni.cpp` currently does not link against libtorrent headers and returns stub data (`[]`).
- **Impact**: React Native does not receive real BitTorrent swarm telemetry.

### Blocker 4: Python Modules are Disconnected from Android App
- **Problem**: The Python modules in `python/` are not embedded into the APK runtime and cannot be executed by React Native or Kotlin.
- **Impact**: Duplicate logic exists between Python and TypeScript; Python code is dead code in the mobile bundle.

### Blocker 5: Android 15 `dataSync` Foreground Service 6-Hour Timeout
- **Problem**: Android 15 (API 35) enforces a 6-hour execution limit on `dataSync` services when backgrounded.
- **Impact**: Long-running background downloads and overnight seeding will be terminated by the OS on Android 15 devices.

---

## 8. EXACT COMMANDS TO RESOLVE BLOCKERS

### Step 1: Install JDK 17 & Android SDK Tools (For Blocker 1)
Run in PowerShell (or install Eclipse Adoptium Temurin 17):
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
winget install Google.AndroidStudio
```
Add to user environment:
```powershell
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot', 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

### Step 2: Compile libtorrent 2.1.x for Android ARM64 (For Blockers 2 & 3)
On a machine with Android NDK r25+ and CMake:
```bash
git clone --recurse-submodules -b RC_2_1 https://github.com/arvidn/libtorrent.git
cd libtorrent
cmake -B build_arm64 \
    -DCMAKE_TOOLCHAIN_FILE="$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="arm64-v8a" \
    -DANDROID_PLATFORM=android-24 \
    -DCMAKE_BUILD_TYPE=Release \
    -Dcrypto=openssl \
    -Dbuild_tests=OFF \
    -Dbuild_examples=OFF
cmake --build build_arm64 --parallel
mkdir -p D:/github/torrentflow-mobile/android/app/src/main/jniLibs/arm64-v8a
cp build_arm64/bin/libtorrent-rasterbar.so D:/github/torrentflow-mobile/android/app/src/main/jniLibs/arm64-v8a/
```

### Step 3: Link C++ JNI Implementation (For Blocker 3)
Uncomment and link `lt::session` and `lt::add_torrent_params` in `native/jni/torrent_engine_jni.cpp` to call real libtorrent methods instead of the `NativeTorrentSession` mock stub.

### Step 4: Resolve Python Architecture (For Blocker 4)
Choose one of the following architectural paths:
- **Option A (Recommended for React Native)**: Keep React Native / TypeScript as the sole application logic tier (`src/services/TorrentEngine.ts` + `DatabaseService.ts`). The Python modules in `python/` serve as the reference specification and verification harness. Remove runtime dependence on Python in Android.
- **Option B (Chaquopy Embedding)**: Add `id "com.chaquo.python" version "15.0.1"` to `android/build.gradle` and configure `python { version "3.11" }` in `android/app/build.gradle`.

### Step 5: Android 15 Timeout Mitigation (For Blocker 5)
In `TorrentDownloadService.kt`:
Prompt users on Android 15+ devices to request `android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, and utilize `WorkManager` periodic workers to re-evaluate and resume active transfer jobs within policy limits.

### Step 6: Build Production Release AAB via EAS (Cloud Alternative)
If local JDK/NDK cannot be installed on this host:
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
```
This delegates the Gradle and NDK compilation to an official Linux build worker with pre-installed Android NDK r25+ and OpenJDK 17.

