# Stage 8 — content, video/audio callback bridge

Added:
- Android-side VideoFrame and AudioBlock pipeline.
- AudioTrack streaming sink.
- Android game-content import into private app storage.
- Native callback registration from Libretro to Kotlin.
- Native video frame and audio block forwarding hooks.
- Native content load/unload API.
- GameSession now loads the selected user-owned game file through the native bridge.

Important:
This is an integration layer, not a claim that a particular PS1 core binary is already packaged. The selected core still needs to be built/supplied legally, and its actual callback registration must be wired to `combat3_emit_video` / `combat3_emit_audio` plus environment/input callbacks. Pixel format conversion (RGB565/XRGB8888) and high-performance texture upload should be finalized with the chosen core.

No ROM, Sony BIOS, or proprietary core binary is included.
