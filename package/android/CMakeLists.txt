project(ReactNativeList)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME ReactNativeList)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Define C++ library and add all sources
add_library(${PACKAGE_NAME} SHARED
        ../cpp/HybridUiManagerHelper.cpp
        ../cpp/WorkletsUiCallInvoker.cpp
        src/main/cpp/cpp-adapter.cpp
        src/main/cpp/JHybridUiListModule.cpp
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/ReactNativeList+autolinking.cmake)

# Set up local includes
include_directories(
        "src/main/cpp"
        "../cpp"
)


find_library(LOG_LIB log)
find_package(react-native-worklets REQUIRED)       # <-- for Worklets

# Worklets prefab headers transitively need these React Native internal headers
# (they are PRIVATE in the worklets CMakeLists.txt, so not propagated via prefab)
# Gradle resolves this from the consuming app because package-manager layouts are not stable.
if(NOT DEFINED REACT_NATIVE_DIR OR REACT_NATIVE_DIR STREQUAL "")
    message(FATAL_ERROR "REACT_NATIVE_DIR must be provided by the Android Gradle build.")
endif()
target_include_directories(${PACKAGE_NAME} PRIVATE
        "${REACT_NATIVE_DIR}/ReactCommon"
        "${REACT_NATIVE_DIR}/ReactCommon/callinvoker"
        "${REACT_NATIVE_DIR}/ReactCommon/runtimeexecutor"
        "${REACT_NATIVE_DIR}/ReactCommon/jsiexecutor"
        "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/turbomodule"
        "${REACT_NATIVE_DIR}/ReactCommon/react/nativemodule/core/ReactCommon"
)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android                                   # <-- Android core
        react-native-worklets::worklets           # <-- Worklets C++ library
)
