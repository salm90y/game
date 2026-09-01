#include "ps1_retro_bridge.h"
#include <dlfcn.h>
#include <android/log.h>
#include <android/native_window.h>
#include <android/native_window_jni.h>
#include <cstring>
#include <string>
#include <vector>
#include <sys/stat.h>

#define LOG_TAG "PS1NativeBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Libretro environment command values used here. Keeping them local makes the
// bridge tolerant of older/minimal libretro headers.
static constexpr unsigned RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY = 9;
static constexpr unsigned RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY = 31;

static void *g_core_dl_handle = nullptr;
static ANativeWindow *g_native_window = nullptr;
static bool g_core_initialized = false;
static bool g_game_loaded = false;
static std::string g_system_directory;
static std::string g_save_directory;

static retro_init_t g_retro_init = nullptr;
static retro_deinit_t g_retro_deinit = nullptr;
static retro_load_game_t g_retro_load_game = nullptr;
static retro_unload_game_t g_retro_unload_game = nullptr;
static retro_run_t g_retro_run = nullptr;
static retro_serialize_size_t g_retro_serialize_size = nullptr;
static retro_serialize_t g_retro_serialize = nullptr;
static retro_unserialize_t g_retro_unserialize = nullptr;
static enum retro_pixel_format g_pixel_format = RETRO_PIXEL_FORMAT_RGB565;
static uint16_t g_p1_input_mask = 0;
static uint16_t g_p2_input_mask = 0;

static void retro_video_refresh_cb(const void *data, unsigned width, unsigned height, size_t pitch) {
    if (!data || !g_native_window || width == 0 || height == 0) return;
    ANativeWindow_Buffer buffer;
    if (ANativeWindow_lock(g_native_window, &buffer, nullptr) != 0) return;

    const size_t bpp = (g_pixel_format == RETRO_PIXEL_FORMAT_XRGB8888) ? 4u : 2u;
    const size_t src_row = static_cast<size_t>(width) * bpp;
    const size_t dst_row = static_cast<size_t>(buffer.stride) * bpp;
    const unsigned rows = height < static_cast<unsigned>(buffer.height) ? height : static_cast<unsigned>(buffer.height);
    const auto *src = static_cast<const uint8_t *>(data);
    auto *dst = static_cast<uint8_t *>(buffer.bits);
    for (unsigned y = 0; y < rows; ++y) {
        const size_t bytes = src_row < dst_row ? src_row : dst_row;
        memcpy(dst + y * dst_row, src + y * pitch, bytes);
    }
    ANativeWindow_unlockAndPost(g_native_window);
}

static size_t retro_audio_sample_batch_cb(const int16_t *, size_t frames) { return frames; }
static void retro_audio_sample_cb(int16_t, int16_t) {}
static void retro_input_poll_cb(void) {}

static int16_t retro_input_state_cb(unsigned port, unsigned device, unsigned, unsigned id) {
    if (device != RETRO_DEVICE_JOYPAD) return 0;
    const uint16_t mask = port == 0 ? g_p1_input_mask : g_p2_input_mask;
    switch (id) {
        case RETRO_DEVICE_ID_JOYPAD_B: return (mask & (1 << 0)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_A: return (mask & (1 << 1)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_Y: return (mask & (1 << 2)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_X: return (mask & (1 << 3)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_L: return (mask & (1 << 4)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_R: return (mask & (1 << 5)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_L2: return (mask & (1 << 6)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_R2: return (mask & (1 << 7)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_SELECT: return (mask & (1 << 8)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_START: return (mask & (1 << 9)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_UP: return (mask & (1 << 12)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_DOWN: return (mask & (1 << 13)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_LEFT: return (mask & (1 << 14)) ? 1 : 0;
        case RETRO_DEVICE_ID_JOYPAD_RIGHT: return (mask & (1 << 15)) ? 1 : 0;
        default: return 0;
    }
}

static bool retro_environment_cb(unsigned cmd, void *data) {
    if (!data) return false;
    switch (cmd) {
        case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
            if (g_system_directory.empty()) return false;
            *static_cast<const char **>(data) = g_system_directory.c_str();
            return true;
        case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
            if (g_save_directory.empty()) return false;
            *static_cast<const char **>(data) = g_save_directory.c_str();
            return true;
        case 10: // RETRO_ENVIRONMENT_SET_PIXEL_FORMAT
            g_pixel_format = *static_cast<enum retro_pixel_format *>(data);
            return g_pixel_format == RETRO_PIXEL_FORMAT_RGB565 || g_pixel_format == RETRO_PIXEL_FORMAT_XRGB8888;
        case 3: // RETRO_ENVIRONMENT_GET_CAN_DUPE
            *static_cast<bool *>(data) = true;
            return true;
        default:
            return false;
    }
}

static void ensure_directory(const std::string &path) {
    if (!path.empty()) mkdir(path.c_str(), 0700);
}

extern "C" {
JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadCore(JNIEnv *env, jobject, jstring core_path) {
    if (!core_path) return JNI_FALSE;
    if (g_core_dl_handle) return g_core_initialized ? JNI_TRUE : JNI_FALSE;

    const char *path = env->GetStringUTFChars(core_path, nullptr);
    if (!path) return JNI_FALSE;
    const std::string corePath(path);
    env->ReleaseStringUTFChars(core_path, path);

    g_core_dl_handle = dlopen(corePath.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (!g_core_dl_handle) {
        LOGE("dlopen failed: %s", dlerror());
        return JNI_FALSE;
    }

    // Core lives in <filesDir>/cores/core.so, so expose <filesDir>/system and
    // <filesDir>/saves to Libretro. This is required for SCPH1001.BIN discovery.
    const size_t slash = corePath.find_last_of('/');
    const std::string coreDir = slash == std::string::npos ? std::string() : corePath.substr(0, slash);
    const size_t parentSlash = coreDir.find_last_of('/');
    const std::string filesDir = parentSlash == std::string::npos ? coreDir : coreDir.substr(0, parentSlash);
    g_system_directory = filesDir + "/system";
    g_save_directory = filesDir + "/saves";
    ensure_directory(g_system_directory);
    ensure_directory(g_save_directory);

    g_retro_init = (retro_init_t)dlsym(g_core_dl_handle, "retro_init");
    g_retro_deinit = (retro_deinit_t)dlsym(g_core_dl_handle, "retro_deinit");
    g_retro_load_game = (retro_load_game_t)dlsym(g_core_dl_handle, "retro_load_game");
    g_retro_unload_game = (retro_unload_game_t)dlsym(g_core_dl_handle, "retro_unload_game");
    g_retro_run = (retro_run_t)dlsym(g_core_dl_handle, "retro_run");
    g_retro_serialize_size = (retro_serialize_size_t)dlsym(g_core_dl_handle, "retro_serialize_size");
    g_retro_serialize = (retro_serialize_t)dlsym(g_core_dl_handle, "retro_serialize");
    g_retro_unserialize = (retro_unserialize_t)dlsym(g_core_dl_handle, "retro_unserialize");
    auto set_env = (retro_set_environment_t)dlsym(g_core_dl_handle, "retro_set_environment");
    auto set_video = (retro_set_video_refresh_t)dlsym(g_core_dl_handle, "retro_set_video_refresh");
    auto set_audio = (retro_set_audio_sample_t)dlsym(g_core_dl_handle, "retro_set_audio_sample");
    auto set_audio_batch = (retro_set_audio_sample_batch_t)dlsym(g_core_dl_handle, "retro_set_audio_sample_batch");
    auto set_input = (retro_set_input_state_t)dlsym(g_core_dl_handle, "retro_set_input_state");
    auto set_poll = (retro_set_input_poll_t)dlsym(g_core_dl_handle, "retro_set_input_poll");

    if (!g_retro_init || !g_retro_deinit || !g_retro_load_game || !g_retro_unload_game || !g_retro_run ||
        !set_env || !set_video || !set_input || !set_poll) {
        LOGE("Required Libretro symbols are missing");
        dlclose(g_core_dl_handle);
        g_core_dl_handle = nullptr;
        return JNI_FALSE;
    }

    set_env(retro_environment_cb);
    set_video(retro_video_refresh_cb);
    if (set_audio) set_audio(retro_audio_sample_cb);
    if (set_audio_batch) set_audio_batch(retro_audio_sample_batch_cb);
    set_input(retro_input_state_cb);
    set_poll(retro_input_poll_cb);
    g_retro_init();
    g_core_initialized = true;
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadGame(JNIEnv *env, jobject, jstring game_path) {
    if (!g_core_initialized || !g_retro_load_game || !game_path) return JNI_FALSE;
    const char *path = env->GetStringUTFChars(game_path, nullptr);
    if (!path) return JNI_FALSE;
    retro_game_info info = {};
    info.path = path;
    const bool ok = g_retro_load_game(&info);
    env->ReleaseStringUTFChars(game_path, path);
    g_game_loaded = ok;
    if (!ok) LOGE("Libretro rejected game path: %s", path);
    return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeRunFrame(JNIEnv *, jobject, jint p1, jint p2) {
    if (!g_core_initialized || !g_game_loaded || !g_retro_run) return;
    g_p1_input_mask = static_cast<uint16_t>(p1);
    g_p2_input_mask = static_cast<uint16_t>(p2);
    g_retro_run();
}

JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeUnloadGame(JNIEnv *, jobject) {
    if (g_game_loaded && g_retro_unload_game) g_retro_unload_game();
    if (g_core_initialized && g_retro_deinit) g_retro_deinit();
    g_game_loaded = false;
    g_core_initialized = false;
    if (g_core_dl_handle) dlclose(g_core_dl_handle);
    g_core_dl_handle = nullptr;
    g_system_directory.clear();
    g_save_directory.clear();
    g_retro_init = nullptr; g_retro_deinit = nullptr; g_retro_load_game = nullptr;
    g_retro_unload_game = nullptr; g_retro_run = nullptr; g_retro_serialize_size = nullptr;
    g_retro_serialize = nullptr; g_retro_unserialize = nullptr;
}

JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeSetSurface(JNIEnv *env, jobject, jobject surface) {
    if (g_native_window) { ANativeWindow_release(g_native_window); g_native_window = nullptr; }
    if (surface) g_native_window = ANativeWindow_fromSurface(env, surface);
}

JNIEXPORT jbyteArray JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeSaveState(JNIEnv *env, jobject) {
    if (!g_game_loaded || !g_retro_serialize_size || !g_retro_serialize) return nullptr;
    const size_t size = g_retro_serialize_size();
    if (size == 0 || size > 64u * 1024u * 1024u) return nullptr;
    std::vector<uint8_t> state(size);
    if (!g_retro_serialize(state.data(), size)) return nullptr;
    jbyteArray out = env->NewByteArray(static_cast<jsize>(size));
    if (!out) return nullptr;
    env->SetByteArrayRegion(out, 0, static_cast<jsize>(size), reinterpret_cast<const jbyte *>(state.data()));
    return out;
}

JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadState(JNIEnv *env, jobject, jbyteArray state_bytes) {
    if (!g_game_loaded || !g_retro_unserialize || !state_bytes) return JNI_FALSE;
    const jsize len = env->GetArrayLength(state_bytes);
    if (len <= 0 || len > 64 * 1024 * 1024) return JNI_FALSE;
    jbyte *bytes = env->GetByteArrayElements(state_bytes, nullptr);
    if (!bytes) return JNI_FALSE;
    const bool ok = g_retro_unserialize(bytes, static_cast<size_t>(len));
    env->ReleaseByteArrayElements(state_bytes, bytes, JNI_ABORT);
    return ok ? JNI_TRUE : JNI_FALSE;
}
}
