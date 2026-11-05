#!/usr/bin/env bash
# ==============================================================================
# TorrentFlow Mobile — libtorrent 2.1.x Android NDK Build Script
# 
# Builds libtorrent rasterbar 2.1.x for Android ARM64-v8a, armeabi-v7a, and x86_64
# Prerequisites: Android NDK r25+, CMake 3.22+, Ninja, OpenSSL, Boost 1.84+
# ==============================================================================

set -euo pipefail

NDK_PATH="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [[ -z "$NDK_PATH" ]]; then
    echo "ERROR: ANDROID_NDK_HOME or ANDROID_NDK_ROOT must be set."
    exit 1
fi

API_LEVEL=24
ABIS=("arm64-v8a" "armeabi-v7a" "x86_64")
BUILD_DIR="$(pwd)/build_android"
OUTPUT_DIR="$(pwd)/prebuilts"

mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

echo "=== Building libtorrent 2.1.x with Android NDK: $NDK_PATH ==="

for ABI in "${ABIS[@]}"; do
    echo "--- Configuring for ABI: $ABI ---"
    ABI_BUILD_DIR="$BUILD_DIR/$ABI"
    mkdir -p "$ABI_BUILD_DIR"

    cmake -B "$ABI_BUILD_DIR" \
        -G Ninja \
        -DCMAKE_TOOLCHAIN_FILE="$NDK_PATH/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="$ABI" \
        -DANDROID_PLATFORM="android-$API_LEVEL" \
        -DANDROID_STL=c++_shared \
        -DCMAKE_BUILD_TYPE=Release \
        -Dbuild_tests=OFF \
        -Dbuild_examples=OFF \
        -Dbuild_tools=OFF \
        -Ddeprecated-functions=OFF \
        -Dencryption=ON \
        -Dcrypto=openssl \
        -DCMAKE_CXX_STANDARD=17

    echo "--- Compiling $ABI ---"
    ninja -C "$ABI_BUILD_DIR"

    ABI_OUT_DIR="$OUTPUT_DIR/$ABI"
    mkdir -p "$ABI_OUT_DIR"
    cp "$ABI_BUILD_DIR/bin/libtorrent-rasterbar.so" "$ABI_OUT_DIR/"
    echo "Successfully generated $ABI_OUT_DIR/libtorrent-rasterbar.so"
done

echo "=== All Android ABIs compiled successfully! ==="

