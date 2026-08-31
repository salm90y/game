#include <dlfcn.h>
#include <android/log.h>
#include "libretro_min.h"

extern "C" retro_environment_t combat3_env();
extern "C" retro_video_refresh_t combat3_video();
extern "C" retro_audio_sample_t combat3_audio();
extern "C" retro_audio_sample_batch_t combat3_audio_batch();
extern "C" retro_input_poll_t combat3_poll();
extern "C" retro_input_state_t combat3_state();

#define LOG_TAG "Combat3Libretro"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static void* g_handle=nullptr;
static void (*p_init)()=nullptr;
static void (*p_deinit)()=nullptr;
static void (*p_run)()=nullptr;
static bool (*p_load_game)(const void*)=nullptr;
static void (*p_unload_game)()=nullptr;
static void (*p_set_env)(retro_environment_t)=nullptr;
static void (*p_set_video)(retro_video_refresh_t)=nullptr;
static void (*p_set_audio)(retro_audio_sample_t)=nullptr;
static void (*p_set_audio_batch)(retro_audio_sample_batch_t)=nullptr;
static void (*p_set_poll)(retro_input_poll_t)=nullptr;
static void (*p_set_state)(retro_input_state_t)=nullptr;

template<class T> static T sym(const char* n){return reinterpret_cast<T>(dlsym(g_handle,n));}

extern "C" bool combat3_load_core(const char* path){
    if(g_handle) return true;
    g_handle=dlopen(path,RTLD_NOW|RTLD_LOCAL);
    if(!g_handle){LOGE("dlopen failed: %s",dlerror());return false;}

    p_init=sym<decltype(p_init)>("retro_init");
    p_deinit=sym<decltype(p_deinit)>("retro_deinit");
    p_run=sym<decltype(p_run)>("retro_run");
    p_load_game=sym<decltype(p_load_game)>("retro_load_game");
    p_unload_game=sym<decltype(p_unload_game)>("retro_unload_game");
    p_set_env=sym<decltype(p_set_env)>("retro_set_environment");
    p_set_video=sym<decltype(p_set_video)>("retro_set_video_refresh");
    p_set_audio=sym<decltype(p_set_audio)>("retro_set_audio_sample");
    p_set_audio_batch=sym<decltype(p_set_audio_batch)>("retro_set_audio_sample_batch");
    p_set_poll=sym<decltype(p_set_poll)>("retro_input_poll");
    p_set_state=sym<decltype(p_set_state)>("retro_input_state");

    bool ok=p_init&&p_deinit&&p_run&&p_load_game&&p_unload_game&&p_set_env&&p_set_video&&
            p_set_audio&&p_set_audio_batch&&p_set_poll&&p_set_state;
    if(!ok){LOGE("Core is missing required Libretro symbols"); combat3_unload_core(); return false;}

    p_set_env(combat3_env());
    p_set_video(combat3_video());
    p_set_audio(combat3_audio());
    p_set_audio_batch(combat3_audio_batch());
    p_set_poll(combat3_poll());
    p_set_state(combat3_state());
    p_init();
    return true;
}

extern "C" void combat3_unload_core(){
    if(!g_handle)return;
    if(p_deinit)p_deinit();
    dlclose(g_handle); g_handle=nullptr;
}

extern "C" bool combat3_load_content(const char* path){
    if(!p_load_game||!path)return false;
    struct RetroGameInfo{const char* path;const void* data;size_t size;const char* meta;};
    RetroGameInfo info{path,nullptr,0,nullptr};
    return p_load_game(&info);
}
extern "C" void combat3_unload_content(){if(p_unload_game)p_unload_game();}
extern "C" void combat3_run(){if(p_run)p_run();}
