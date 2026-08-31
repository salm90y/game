# Stage 7
Frontend integration layer added:
- VideoFrame/AudioBlock models
- LibretroFrontend callback hub
- GameSession lifecycle
- JNI frontend configuration hook
- Native callback source included in CMake
- Clean game viewport remains isolated

ROM and BIOS are not included. A complete playable build still requires wiring actual Libretro callbacks (video/audio/input/environment) to Android and then implementing the real two-device synchronization transport.
