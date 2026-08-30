# Combat 3 Multiplayer — Final Integration Status

This repository is the integration target for the Android Combat 3 multiplayer project.

## Current architecture
- Android project under `android/`
- Native C++/JNI bridge
- Libretro-based emulator integration point
- USB/Bluetooth gamepad input mapping
- deterministic input/frame protocol
- room/game fingerprint validation
- multiplayer connection state model

## Legal content model
No ROM, BIOS, ISO, CHD, or proprietary PS1 core binary is included in this repository. The application is intended to use user-supplied game/BIOS content and a legally distributable Libretro core built from its source.

## Build
The Android project includes Gradle configuration and a Gradle wrapper under `android/`.

## Important status
A production APK and verified two-device online match require an Android SDK/NDK build environment, a legally distributable PS1 core, user-supplied game/BIOS content, and a deployed signaling/relay service. Those external runtime requirements are not represented as completed merely by source files.
