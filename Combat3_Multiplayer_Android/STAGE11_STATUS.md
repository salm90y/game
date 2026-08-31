# Stage 11 — physical gamepad + deterministic input packets

Added:
- Android Gamepad/Joystick key mapping to RetroPad.
- Analog X/Y handling with dead-zone.
- GameSurface now exposes controller state.
- Native pad state is updated before each emulated frame.
- Deterministic InputPacket format containing room, frame, player, buttons and analog values.
- NetplayClock for monotonically ordered remote frames.

This completes the controller-to-emulation input path at the application boundary.

The next major block is the actual network room transport:
- signaling;
- peer connection;
- low-latency data channel;
- input packet send/receive;
- clock synchronization;
- missing-frame handling;
- desync detection.

No ROM/BIOS/core binary is included.
