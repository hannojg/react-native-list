cmake_minimum_required(VERSION 3.22.1)
project(ListRuntimeTests)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(hermes-engine REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

add_library(ListRuntimeTests SHARED RuntimeTests.cpp)
target_compile_features(ListRuntimeTests PRIVATE cxx_std_20)
include("${REACT_NATIVE_DIR}/ReactAndroid/cmake-utils/folly-flags.cmake")
target_compile_options(ListRuntimeTests PRIVATE ${folly_FLAGS})
target_include_directories(ListRuntimeTests PRIVATE
  "${REACT_NATIVE_DIR}/ReactCommon"
  "${REACT_NATIVE_DIR}/ReactCommon/callinvoker"
  "${REACT_NATIVE_DIR}/ReactCommon/react/nativemodule/core"
  "${REACT_NATIVE_DIR}/ReactCommon/react/nativemodule/core/platform/android"
  "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni"
  "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule"
)
target_link_libraries(ListRuntimeTests ReactAndroid::reactnative ReactAndroid::jsi hermes-engine::hermesvm fbjni::fbjni)
