cmake_minimum_required(VERSION 3.22.1)
project("combat3")
add_library(combat3 SHARED
    libretro_loader.cpp
    frontend_callbacks.cpp
    combat3_bridge.cpp
    retro_callbacks.cpp
)
target_include_directories(combat3 PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
