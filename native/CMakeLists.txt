cmake_minimum_required(VERSION 3.22.1)

project(torrentflow_native CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Android NDK configuration
# Target ABIs: arm64-v8a, armeabi-v7a, x86_64
message(STATUS "Configuring TorrentFlow Native Engine for ABI: ${ANDROID_ABI}")

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/jni
    ${CMAKE_CURRENT_SOURCE_DIR}/libtorrent/include
    ${CMAKE_CURRENT_SOURCE_DIR}/boost/include
    ${CMAKE_CURRENT_SOURCE_DIR}/openssl/include
)

# Native libtorrent library configuration
# Libtorrent 2.1.x prebuilt or compiled static/shared library per ABI
add_library(torrentflow_native SHARED
    jni/torrent_engine_jni.cpp
)

# System and NDK libraries
find_library(log-lib log)
find_library(android-lib android)

# Compiler definitions for libtorrent 2.1.x on Android
target_compile_definitions(torrentflow_native PRIVATE
    TORRENT_USE_OPENSSL=1
    BOOST_ASIO_ENABLE_CANCELIO=1
    TORRENT_DISABLE_LOGGING=0
    TORRENT_EXPORT=
    _FILE_OFFSET_BITS=64
)

target_link_libraries(torrentflow_native
    PRIVATE
    ${log-lib}
    ${android-lib}
)

