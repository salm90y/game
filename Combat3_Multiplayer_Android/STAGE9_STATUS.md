# Stage 9 — frame loop and callback foundation

Added:
- RetroPad constants.
- ControllerState model.
- 60 FPS emulation clock.
- Dedicated emulation thread.
- Libretro video/audio callback foundation.
- Libretro input-state callback foundation for ports 0 and 1.
- Callback configuration hook after core loading.

This is the foundation for running one emulated frame at a time.

Still required before calling it a finished playable build:
- Complete Libretro environment commands and pixel-format handling.
- Connect callback data to a high-performance Android Surface/Texture rather than per-frame Bitmap allocation.
- Implement robust audio buffering.
- Feed actual controller state into the native input callback.
- Integrate a legally distributable PS1 core binary and its source/license notices.
- Implement the real two-device transport and deterministic synchronization.
