#ifndef NETPLAY_SYNC_H
#define NETPLAY_SYNC_H

#include <cstdint>
#include <vector>
#include <deque>
#include <mutex>

struct FrameInput {
    uint32_t frame_index;
    uint16_t p1_mask;
    uint16_t p2_mask;
    uint32_t checksum;
};

class NetplaySyncBuffer {
public:
    NetplaySyncBuffer();
    void pushLocalInput(uint32_t frame, uint16_t mask);
    void pushRemoteInput(uint32_t frame, uint16_t mask);
    bool getInputForFrame(uint32_t frame, uint16_t &p1, uint16_t &p2);
    void reset();

private:
    std::mutex mtx_;
    std::deque<FrameInput> history_;
    uint16_t last_p1_;
    uint16_t last_p2_;
};

#endif
