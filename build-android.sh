#!/bin/bash
set -e
export ANDROID_HOME="/c/Users/Silex/AppData/Local/Android/Sdk"
export NDK_HOME="/c/Users/Silex/AppData/Local/Android/Sdk/ndk/27.1.12297006"
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.7.6-hotspot"
export PROTOC="/c/Users/Silex/ark-wallet/tools/protoc/bin/protoc.exe"
export AARCH64_LINUX_ANDROID_OPENSSL_DIR="/c/Users/Silex/ark-wallet/tools/android-openssl/aarch64"
export AARCH64_LINUX_ANDROID_OPENSSL_STATIC="1"
cd /c/Users/Silex/ark-wallet
npm run tauri android build -- --apk --target aarch64
