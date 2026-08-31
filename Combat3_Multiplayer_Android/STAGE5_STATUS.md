# Stage 5 status

Implemented in the project:
- Android NDK/CMake integration.
- JNI native bridge.
- Native core loading boundary.
- Core directory management.
- MatchCoordinator connecting local/remote frame inputs to the native bridge.
- PeerTransport contract for production networking.

Important: the actual PS1 core binary is NOT bundled. DuckStation's libretro core is available for Android AArch64 in the Libretro ecosystem, but its redistribution/licensing terms must be checked before packaging it into an application. The project therefore expects a legally usable `.so` supplied separately.

Also not bundled:
- PS1 BIOS
- ROM/ISO
- copyrighted assets

The app is now structurally ready for a real core binary. The remaining external dependency is the actual core and a production network implementation.
