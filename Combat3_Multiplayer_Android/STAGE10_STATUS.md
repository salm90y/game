# Stage 10 — real callback wiring

Fixed and added:
- Complete minimal Libretro ABI declarations including input callback types.
- Actual registration of environment/video/audio/input callbacks after core loading.
- Native controller state storage for ports 0 and 1.
- JNI `nativeSetPads` bridge.
- Core lifecycle now calls `retro_init()` only after callback registration.
- Core symbol validation and safe unload on failure.
- User-owned game content loading remains supported.

This is the first stage where the frontend callback chain is wired end-to-end at the ABI level.

Not included:
- ROM/BIOS.
- A copyrighted/proprietary emulator binary.
- A production relay/signaling server.

Those must be supplied/deployed separately and legally.
