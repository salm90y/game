# Stage 4 — emulator + real netplay integration plan

## Emulator
The project now has a `GameCoreBridge` boundary. The recommended PS1 implementation target is a Libretro-compatible PS1 core such as DuckStation. DuckStation supports Android AArch64/ARMv7 and has a libretro core, but its licensing terms must be reviewed before redistribution. The app therefore does not bundle the core or any ROM/BIOS.

## Game file
The user selects a legally owned game image through Android's document picker. Supported extension validation is provided for common PS1 image formats. A production build should calculate a content hash/fingerprint and require both peers to have the same game fingerprint before entering the match.

## Netplay
The current `NetplayTransport` is deliberately abstract. Production should use:
1. Signaling service for room creation and peer discovery.
2. WebRTC DataChannel or an equivalent low-latency transport.
3. Sequence/frame numbers.
4. Jitter buffering.
5. Input delay / rollback strategy compatible with the chosen emulator core.
6. Disconnect/reconnect and desync detection.

## Critical compatibility point
A generic "send controller buttons over the internet" layer is not enough to guarantee deterministic PS1 emulation. The selected core must expose a compatible frame/input/state API or the emulator itself must provide netplay support. Therefore this build stops at the correct integration boundary rather than pretending a loopback transport is a working online match.

## User-owned BIOS
A PS1 BIOS is also normally required by the emulator. The app should provide a separate "Import BIOS" flow for a BIOS dumped from the user's own hardware. No BIOS is bundled.
