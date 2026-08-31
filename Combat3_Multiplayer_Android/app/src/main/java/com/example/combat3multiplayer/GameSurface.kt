package com.example.combat3multiplayer

import android.content.Context
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView

class GameSurface(context: Context): SurfaceView(context), SurfaceHolder.Callback {
    private val mapper=ControllerMapper()
    init { holder.addCallback(this); isFocusable=true; requestFocus() }

    fun controllerState():ControllerState=mapper.state

    fun onGamepadKey(e:KeyEvent) {
        if(e.source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD ||
           e.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK) {
            mapper.key(e.keyCode,e.action==KeyEvent.ACTION_DOWN)
        }
    }

    fun onGamepadMotion(e:MotionEvent) {
        if(e.source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK)
            mapper.motion(e)
    }

    override fun surfaceCreated(h:SurfaceHolder){}
    override fun surfaceChanged(h:SurfaceHolder,format:Int,w:Int,hgt:Int){}
    override fun surfaceDestroyed(h:SurfaceHolder){}
}
