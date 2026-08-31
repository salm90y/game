package com.ps1.netplay.core

import android.util.Log
import android.view.Surface

/**
 * Safe Kotlin/JNI bridge to the PS1 Libretro native core.
 *
 * The native library is optional at application startup: a missing or incompatible
 * ABI must never crash the launcher. Native calls are made only after a successful
 * System.loadLibrary().
 */
object NativeCoreBridge {
    private const val TAG = "NativeCoreBridge"

    @Volatile
    private var libraryLoaded = false

    init {
        try {
            System.loadLibrary("ps1_netplay_core")
            libraryLoaded = true
            Log.i(TAG, "Native library loaded")
        } catch (e: UnsatisfiedLinkError) {
            libraryLoaded = false
            Log.e(TAG, "Native library unavailable; app will remain usable without emulation", e)
        } catch (e: SecurityException) {
            libraryLoaded = false
            Log.e(TAG, "Native library blocked by platform security", e)
        }
    }

    fun isAvailable(): Boolean = libraryLoaded

    external fun nativeLoadCore(corePath: String): Boolean
    external fun nativeLoadGame(gamePath: String): Boolean
    external fun nativeRunFrame(p1Mask: Int, p2Mask: Int)
    external fun nativeUnloadGame()
    external fun nativeSetSurface(surface: Surface?)
    external fun nativeSaveState(): ByteArray?
    external fun nativeLoadState(stateBytes: ByteArray): Boolean

    fun safeLoadCore(corePath: String): Boolean =
        if (libraryLoaded) runCatching { nativeLoadCore(corePath) }.getOrElse {
            Log.e(TAG, "nativeLoadCore failed", it)
            false
        } else false

    fun safeLoadGame(gamePath: String): Boolean =
        if (libraryLoaded) runCatching { nativeLoadGame(gamePath) }.getOrElse {
            Log.e(TAG, "nativeLoadGame failed", it)
            false
        } else false

    fun safeRunFrame(p1Mask: Int, p2Mask: Int) {
        if (libraryLoaded) runCatching { nativeRunFrame(p1Mask, p2Mask) }
            .onFailure { Log.e(TAG, "nativeRunFrame failed", it) }
    }

    fun safeUnloadGame() {
        if (libraryLoaded) runCatching { nativeUnloadGame() }
            .onFailure { Log.e(TAG, "nativeUnloadGame failed", it) }
    }

    fun safeSetSurface(surface: Surface?) {
        if (libraryLoaded) runCatching { nativeSetSurface(surface) }
            .onFailure { Log.e(TAG, "nativeSetSurface failed", it) }
    }

    fun safeSaveState(): ByteArray? =
        if (libraryLoaded) runCatching { nativeSaveState() }.getOrNull() else null

    fun safeLoadState(stateBytes: ByteArray): Boolean =
        if (libraryLoaded) runCatching { nativeLoadState(stateBytes) }.getOrDefault(false) else false
}
