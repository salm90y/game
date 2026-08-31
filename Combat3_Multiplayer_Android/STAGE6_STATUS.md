# Stage 6

Completed:
- Switched the planned core path to a GPLv2-compatible Libretro PS1 core family (Beetle PSX / Beetle PSX HW).
- Added a dynamic Libretro `.so` loader.
- Added the basic Libretro ABI bridge and lifecycle hooks.
- Added Android JNI integration for loading/running/unloading the core.
- Kept ROM/ISO and Sony BIOS outside the APK.
- Documented GPLv2 redistribution obligations.

Still required for a fully playable build:
1. Build/package the selected Beetle PSX Android AArch64 core with its complete dependencies and corresponding source/license materials.
2. Implement all Libretro callbacks (video, audio, environment, input) rather than the minimal lifecycle bridge.
3. Connect video frames to the Android clean fullscreen renderer.
4. Connect audio to Android AudioTrack/Oboe.
5. Connect controller mapping to Libretro port 0/1.
6. Add real peer transport and a core-compatible synchronization strategy.
7. Test the exact game and two physical devices.

Note: Beetle PSX's published core documentation explicitly lists Netplay as unsupported, so our two-player online layer must synchronize emulator inputs/state at the frontend level or use an emulator/core with compatible deterministic state APIs. A generic network wrapper alone is not sufficient.
