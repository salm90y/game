# Combat 3 Android build integration

## Legal core model
The application must build/use a legally distributable Libretro PS1 core. Do not commit copyrighted ROMs, BIOS dumps, or proprietary core binaries.

Recommended source integration: `libretro/beetle-psx-libretro` and build the HW variant from source under its applicable GPL-2.0 license.

## User content
The Android app should let the user select their own PS1 game image (CUE/CHD/PBP where supported) and BIOS. The selected content remains outside the repository.

## Architecture
- Kotlin Android UI
- JNI/C++ Libretro bridge
- ARM64 Android native core
- USB/Bluetooth controller mapping
- deterministic frame/input packets
- room/game hash validation
- multiplayer transport layer

## Multiplayer constraint
Beetle PSX HW does not itself provide the required application-level two-device netplay. The project therefore treats multiplayer as a separate deterministic input synchronization layer. A production deployment still requires a signaling/relay service and a real two-device test.

## APK
Use the Gradle project in this directory. A successful debug build produces an APK under `app/build/outputs/apk/debug/`.
