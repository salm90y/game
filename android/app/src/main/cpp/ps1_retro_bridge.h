#ifndef PS1_RETRO_BRIDGE_H
#define PS1_RETRO_BRIDGE_H

#include <jni.h>
#include "libretro.h"

#ifdef __cplusplus
extern "C" {
#endif

JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeSetDirectories(JNIEnv *env, jobject thiz, jstring system_path, jstring save_path);
JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadCore(JNIEnv *env, jobject thiz, jstring core_path);
JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadGame(JNIEnv *env, jobject thiz, jstring game_path);
JNIEXPORT jstring JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeGetLastError(JNIEnv *env, jobject thiz);
JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeRunFrame(JNIEnv *env, jobject thiz, jint p1_mask, jint p2_mask);
JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeUnloadGame(JNIEnv *env, jobject thiz);
JNIEXPORT void JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeSetSurface(JNIEnv *env, jobject thiz, jobject surface);
JNIEXPORT jbyteArray JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeSaveState(JNIEnv *env, jobject thiz);
JNIEXPORT jboolean JNICALL Java_com_ps1_netplay_core_NativeCoreBridge_nativeLoadState(JNIEnv *env, jobject thiz, jbyteArray state_bytes);

#ifdef __cplusplus
}
#endif

#endif
