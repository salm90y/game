package com.ps1.netplay.ui

import android.content.Context
import android.util.AttributeSet
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.ps1.netplay.core.NativeCoreBridge

/**
 * Clean fullscreen hardware-accelerated surface for PS1 video output.
 * Native surface calls are guarded so the launcher cannot crash on devices
 * where the native library is unavailable.
 */
class GameSurfaceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : SurfaceView(context, attrs, defStyleAttr), SurfaceHolder.Callback {

    init {
        holder.addCallback(this)
        isFocusable = true
        isFocusableInTouchMode = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        NativeCoreBridge.safeSetSurface(holder.surface)
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        NativeCoreBridge.safeSetSurface(holder.surface)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        NativeCoreBridge.safeSetSurface(null)
    }
}
