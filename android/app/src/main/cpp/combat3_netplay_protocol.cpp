#include "combat3_netplay_protocol.h"
#include <sstream>
#include <cstdlib>

namespace combat3 {
std::string encode_input_frame(const InputFrame& f) {
    std::ostringstream o;
    o << f.frame << '|' << unsigned(f.player) << '|' << f.buttons << '|' << f.axis_x << '|' << f.axis_y;
    return o.str();
}

bool decode_input_frame(const std::string& s, InputFrame& out) {
    std::istringstream i(s);
    unsigned player=0;
    char a=0;
    if(!(i >> out.frame >> a) || a!='|') return false;
    if(!(i >> player >> a) || a!='|' || player>1) return false;
    if(!(i >> out.buttons >> a) || a!='|') return false;
    if(!(i >> out.axis_x >> a) || a!='|') return false;
    if(!(i >> out.axis_y)) return false;
    out.player=static_cast<uint8_t>(player);
    return true;
}
}
