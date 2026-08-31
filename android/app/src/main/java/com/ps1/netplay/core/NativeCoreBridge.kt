package com.ps1.netplay.core

import android.util.Log
import android.view.Surface

/** JNI bridge. The native library is deliberately loaded lazily, never during launcher startup. */
object NativeCoreBridge {
    private const val TAG = "NativeCoreBridge"

    @Volatile private var libraryLoaded = false
    @Volatile private var loadAttempted = false

    @Synchronized
    fun ensureLoaded(): Boolean {
        if (libraryLoaded) return true
        if (loadAttempted) return false
        loadAttempted = true
        return try {
            System.loadLibrary("ps1_netplay_core")
            libraryLoaded = true
            Log.i(TAG, "Native library loaded")
            true
        } catch (t: Throwable) {
            libraryLoaded = false
            Log.e(TAG, "Native library unavailable", t)
            false
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
        if (ensureLoaded()) runCatching { nativeLoadCore(corePath) }.getOrElse {
            Log.e(TAG, "nativeLoadCore failed", it); false
        } else false

    fun safeLoadGame(gamePath: String): Boolean =
        if (ensureLoaded()) runCatching { nativeLoadGame(gamePath) }.getOrElse {
            Log.e(TAG, "nativeLoadGame failed", it); false
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
        // Do not load JNI merely because Android creates the Surface during launch.
        if (libraryLoaded) runCatching { nativeSetSurface(surface) }
            .onFailure { Log.e(TAG, "nativeSetSurface failed", it) }
    }

    fun safeSaveState(): ByteArray? =
        if (libraryLoaded) runCatching { nativeSaveState() }.getOrNull() else null

    fun safeLoadState(stateBytes: ByteArray): Boolean =
        if (libraryLoaded) runCatching { nativeLoadState(stateBytes) }.getOrDefault(false) else false
}
