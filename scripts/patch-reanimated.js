const fs = require('fs');
const path = require('path');

// 1. Patch Reanimated CMakeLists.txt
const reanimatedCmake = path.join(__dirname, '..', 'node_modules', 'react-native-reanimated', 'android', 'CMakeLists.txt');
if (fs.existsSync(reanimatedCmake)) {
  let content = fs.readFileSync(reanimatedCmake, 'utf8');
  let modified = false;

  if (!content.includes('CMAKE_OBJECT_PATH_MAX')) {
    content = content.replace(
      'set(BUILD_DIR "${CMAKE_SOURCE_DIR}/build")',
      'set(CMAKE_OBJECT_PATH_MAX 235)\n\nset(BUILD_DIR "${CMAKE_SOURCE_DIR}/build")'
    );
    modified = true;
  }

  if (content.includes('set(NATIVEVIEW_DIR "${CMAKE_SOURCE_DIR}/../Common/NativeView")')) {
    content = content.replace(
      'set(NATIVEVIEW_DIR "${CMAKE_SOURCE_DIR}/../Common/NativeView")',
      'set(NATIVEVIEW_DIR "../Common/NativeView")'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(reanimatedCmake, content, 'utf8');
    console.log('[patch-reanimated] Successfully applied Windows MAX_PATH fix to Reanimated CMakeLists.txt');
  }
}

// 2. Patch GestureHandler CMakeLists.txt
const rnghCmake = path.join(__dirname, '..', 'node_modules', 'react-native-gesture-handler', 'android', 'CMakeLists.txt');
if (fs.existsSync(rnghCmake)) {
  let content = fs.readFileSync(rnghCmake, 'utf8');
  let modified = false;

  if (!content.includes('CMAKE_OBJECT_PATH_MAX')) {
    content = content.replace(
      'project(GestureHandlerCodegen)',
      'project(GestureHandlerCodegen)\n\nset(CMAKE_OBJECT_PATH_MAX 260)'
    );
    modified = true;
  }

  if (content.includes('file(GLOB_RECURSE rn_gesture_handler_SRCS CONFIGURE_DEPENDS ../shared/shadowNodes/*.cpp)')) {
    content = content.replace(
      'file(GLOB_RECURSE rn_gesture_handler_SRCS CONFIGURE_DEPENDS ../shared/shadowNodes/*.cpp)',
      'set(rn_gesture_handler_SRCS ../shared/shadowNodes/react/renderer/components/rngesturehandler_codegen/RNGestureHandlerDetectorShadowNode.cpp)'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(rnghCmake, content, 'utf8');
    console.log('[patch-rngh] Successfully applied Windows MAX_PATH fix to GestureHandler CMakeLists.txt');
  }
}
