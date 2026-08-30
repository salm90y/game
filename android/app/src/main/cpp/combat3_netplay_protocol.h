#pragma once
#include <cstdint>
#include <string>

namespace combat3 {
struct InputFrame {
    uint64_t frame;
    uint8_t player;
    uint16_t buttons;
    int16_t axis_x;
    int16_t axis_y;
};

// Stable wire representation for the application-level multiplayer layer.
// Network transport/signaling is intentionally separate from the emulator core.
std::string encode_input_frame(const InputFrame& f);
bool decode_input_frame(const std::string& s, InputFrame& out);
}
