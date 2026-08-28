package com.ps1.netplay.ui

import android.content.Context
import android.util.AttributeSet
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.ps1.netplay.core.NativeCoreBridge

/**
 * Clean Fullscreen Hardware-Accelerated SurfaceView for PS1 Video Output
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
        NativeCoreBridge.nativeSetSurface(holder.surface)
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        NativeCoreBridge.nativeSetSurface(holder.surface)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        NativeCoreBridge.nativeSetSurface(null)
    }
}
