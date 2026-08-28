package com.ps1.netplay.core

import android.view.Surface

/**
 * Kotlin JNI Native Bridge to PS1 Libretro C++ Core (ps1_netplay_core)
 */
object NativeCoreBridge {

    init {
        System.loadLibrary("ps1_netplay_core")
    }

    external fun nativeLoadCore(corePath: String): Boolean
    external fun nativeLoadGame(gamePath: String): Boolean
    external fun nativeRunFrame(p1Mask: Int, p2Mask: Int)
    external fun nativeUnloadGame()
    external fun nativeSetSurface(surface: Surface?)
    external fun nativeSaveState(): ByteArray?
    external fun nativeLoadState(stateBytes: ByteArray): Boolean
}
