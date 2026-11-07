# Native libtorrent 2.1.x Integration Guide

This document details the exact integration method, build process, and ABI bindings used for the native C++ BitTorrent core in **TorrentFlow Mobile**.

---

## 1. Engine Architecture

TorrentFlow Mobile links against **rasterbar libtorrent 2.1.x** via the Android NDK.

```
[Android Kotlin Runtime]
         │ (JNI Interface)
         ▼
[com.torrentflow.mobile.native.TorrentEngineJni]
         │ (System.loadLibrary("torrentflow_native"))
         ▼
[native/jni/torrent_engine_jni.cpp]
         │ (C++17 Static/Shared Linking)
         ▼
[libtorrent-rasterbar.so / libtorrent 2.1.x]
         ├── Boost.Asio & Boost.System (Asynchronous Network I/O)
         ├── OpenSSL 3.x (Protocol Encryption / PE & SHA1/SHA256 piece hashing)
         ├── Mainline DHT Engine (BEP 5)
         └── Fast Resume Serialization (bencoded resume blobs)
```

---

## 2. ABI Support

TorrentFlow Mobile supports the following Android Architectures:
- **`arm64-v8a` (Primary)**: Standard 64-bit architecture for all modern Android smartphones and tablets (Android 9+).
- **`armeabi-v7a`**: 32-bit ARM legacy support.
- **`x86_64`**: For Android Studio Emulators and Chromebooks.

---

## 3. Building libtorrent with Android NDK

To compile libtorrent from source for Android:

1. Clone libtorrent v2.1.x:
   ```bash
   git clone --recurse-submodules -b RC_2_1 https://github.com/arvidn/libtorrent.git
   cd libtorrent
   ```

2. Execute the build script provided in `native/libtorrent/build_libtorrent_android.sh`:
   ```bash
   chmod +x native/libtorrent/build_libtorrent_android.sh
   ./native/libtorrent/build_libtorrent_android.sh
   ```

3. The script compiles libtorrent using the Android NDK toolchain (`android.toolchain.cmake`) with OpenSSL and C++17 flags and generates:
   - `android/app/src/main/jniLibs/arm64-v8a/libtorrent-rasterbar.so`
   - `android/app/src/main/jniLibs/armeabi-v7a/libtorrent-rasterbar.so`
   - `android/app/src/main/jniLibs/x86_64/libtorrent-rasterbar.so`

---

## 4. CMake Configuration (`native/CMakeLists.txt`)

The NDK build system links `torrentflow_native` as a shared library:
```cmake
cmake_minimum_required(VERSION 3.22.1)
project(torrentflow_native CXX)

# React Native 0.81+ New Architecture requires C++20
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/jni
    ${CMAKE_CURRENT_SOURCE_DIR}/libtorrent/include
)

add_library(torrentflow_native SHARED
    jni/torrent_engine_jni.cpp
)

find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(torrentflow_native
    PRIVATE
    ${log-lib}
    ${android-lib}
)
```

---

## 5. Fast Resume Mechanism

When a torrent is paused or the application closes:
1. `torrent_handle::save_resume_data()` is called.
2. An alert (`save_resume_data_alert`) produces a canonical bencoded resume blob.
3. The blob contains:
   - Piece completion bitmask.
   - File download tokens and timestamps.
   - Active peer and tracker stats.
4. The blob is stored as binary data in the SQLite `torrents.resume_data` column.
5. On app restart, `add_torrent_params` is loaded with this resume data, avoiding costly multi-gigabyte rechecks on mobile flash storage.

