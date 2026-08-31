# Combat 3 Multiplayer — Stage 4

This stage prepares the project for the actual emulator/netplay integration.

Added:
- Android document-file inspection for user-owned PS1 game images.
- Game fingerprint/state model.
- Remote input synchronization buffer.
- Explicit emulator/netplay architecture documentation.
- Clear separation between game UI, emulator core, and network transport.

The app does NOT include copyrighted ROMs, BIOS files, or a third-party emulator binary.

For the real playable build, the remaining integration is:
- compile/link a legally compatible PS1 core for Android;
- attach its video/audio callbacks to the clean game surface;
- connect controller input to the core;
- connect a production WebRTC/UDP transport;
- implement core-compatible deterministic synchronization;
- test the exact game on two physical Android devices.
