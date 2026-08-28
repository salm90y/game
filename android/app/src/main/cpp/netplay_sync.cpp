#include "netplay_sync.h"

NetplaySyncBuffer::NetplaySyncBuffer() : last_p1_(0), last_p2_(0) {}

void NetplaySyncBuffer::pushLocalInput(uint32_t frame, uint16_t mask) {
    std::lock_guard<std::mutex> lock(mtx_);
    last_p1_ = mask;
    for (auto &item : history_) {
        if (item.frame_index == frame) {
            item.p1_mask = mask;
            return;
        }
    }
    FrameInput fi = { frame, mask, last_p2_, 0 };
    history_.push_back(fi);
    if (history_.size() > 120) {
        history_.pop_front();
    }
}

void NetplaySyncBuffer::pushRemoteInput(uint32_t frame, uint16_t mask) {
    std::lock_guard<std::mutex> lock(mtx_);
    last_p2_ = mask;
    for (auto &item : history_) {
        if (item.frame_index == frame) {
            item.p2_mask = mask;
            return;
        }
    }
    FrameInput fi = { frame, last_p1_, mask, 0 };
    history_.push_back(fi);
    if (history_.size() > 120) {
        history_.pop_front();
    }
}

bool NetplaySyncBuffer::getInputForFrame(uint32_t frame, uint16_t &p1, uint16_t &p2) {
    std::lock_guard<std::mutex> lock(mtx_);
    for (const auto &item : history_) {
        if (item.frame_index == frame) {
            p1 = item.p1_mask;
            p2 = item.p2_mask;
            return true;
        }
    }
    // Predictive fallback (repeat last known input)
    p1 = last_p1_;
    p2 = last_p2_;
    return false;
}

void NetplaySyncBuffer::reset() {
    std::lock_guard<std::mutex> lock(mtx_);
    history_.clear();
    last_p1_ = 0;
    last_p2_ = 0;
}
