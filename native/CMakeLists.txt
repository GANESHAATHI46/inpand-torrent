cmake_minimum_required(VERSION 3.22.1)

# Project name must be appmodules for React Native New Architecture compatibility
project(appmodules CXX)

# React Native 0.81+ New Architecture requires C++20 (e.g. RawProps.h concepts)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

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

# System and NDK libraries
find_library(log-lib log)
find_library(android-lib android)

# Native libtorrent library configuration
# Libtorrent 2.1.x / TorrentFlow JNI bridge shared library
add_library(torrentflow_native SHARED
    jni/torrent_engine_jni.cpp
)

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

# If building with React Native New Architecture, include React Native's application CMake setup
if(DEFINED REACT_ANDROID_DIR)
    include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
endif()

