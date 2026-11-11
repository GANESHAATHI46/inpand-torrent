cmake_minimum_required(VERSION 3.22.1)
project(appmodules CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# System and NDK libraries
find_library(log-lib log)
find_library(android-lib android)

# Native torrent engine shared library
set(TORRENT_NATIVE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../../../../native)

add_library(torrentflow_native SHARED
    ${TORRENT_NATIVE_DIR}/jni/torrent_engine_jni.cpp
)

target_include_directories(torrentflow_native PRIVATE
    ${TORRENT_NATIVE_DIR}/jni
)

target_compile_definitions(torrentflow_native PRIVATE
    _FILE_OFFSET_BITS=64
)

target_link_libraries(torrentflow_native
    PRIVATE
    ${log-lib}
    ${android-lib}
)

# Standard React Native application setup
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Ensure torrentflow_native is built as a direct dependency of appmodules
add_dependencies(appmodules torrentflow_native)
