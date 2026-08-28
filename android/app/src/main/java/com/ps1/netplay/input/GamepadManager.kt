package com.ps1.netplay.input

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import kotlin.math.abs

/**
 * Handles Bluetooth / USB OTG Gamepad Input, Analog Dead-zones, and Button Remapping
 */
class GamepadManager {

    var deadzone: Float = 0.20f
    private var currentMask: Int = 0

    // Custom Key Mapping Table (Android KeyCode -> PS1 Button Bitmask)
    private val keyMapping = mutableMapOf(
        KeyEvent.KEYCODE_BUTTON_A to PS1InputFrame.BTN_CROSS,
        KeyEvent.KEYCODE_BUTTON_B to PS1InputFrame.BTN_CIRCLE,
        KeyEvent.KEYCODE_BUTTON_X to PS1InputFrame.BTN_SQUARE,
        KeyEvent.KEYCODE_BUTTON_Y to PS1InputFrame.BTN_TRIANGLE,
        KeyEvent.KEYCODE_BUTTON_L1 to PS1InputFrame.BTN_L1,
        KeyEvent.KEYCODE_BUTTON_R1 to PS1InputFrame.BTN_R1,
        KeyEvent.KEYCODE_BUTTON_L2 to PS1InputFrame.BTN_L2,
        KeyEvent.KEYCODE_BUTTON_R2 to PS1InputFrame.BTN_R2,
        KeyEvent.KEYCODE_BUTTON_SELECT to PS1InputFrame.BTN_SELECT,
        KeyEvent.KEYCODE_BUTTON_START to PS1InputFrame.BTN_START,
        KeyEvent.KEYCODE_DPAD_UP to PS1InputFrame.BTN_UP,
        KeyEvent.KEYCODE_DPAD_DOWN to PS1InputFrame.BTN_DOWN,
        KeyEvent.KEYCODE_DPAD_LEFT to PS1InputFrame.BTN_LEFT,
        KeyEvent.KEYCODE_DPAD_RIGHT to PS1InputFrame.BTN_RIGHT
    )

    fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val mapped = keyMapping[keyCode] ?: return false
        currentMask = currentMask or mapped
        return true
    }

    fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        val mapped = keyMapping[keyCode] ?: return false
        currentMask = currentMask and mapped.inv()
        return true
    }

    fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if ((event.source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK &&
            event.action == MotionEvent.ACTION_MOVE
        ) {
            val axisX = event.getAxisValue(MotionEvent.AXIS_X)
            val axisY = event.getAxisValue(MotionEvent.AXIS_Y)
            val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
            val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)

            // Clear D-Pad bits from analog
            var dpadMask = 0

            // Left / Right
            if (axisX < -deadzone || hatX < -0.5f) {
                dpadMask = dpadMask or PS1InputFrame.BTN_LEFT
            } else if (axisX > deadzone || hatX > 0.5f) {
                dpadMask = dpadMask or PS1InputFrame.BTN_RIGHT
            }

            // Up / Down
            if (axisY < -deadzone || hatY < -0.5f) {
                dpadMask = dpadMask or PS1InputFrame.BTN_UP
            } else if (axisY > deadzone || hatY > 0.5f) {
                dpadMask = dpadMask or PS1InputFrame.BTN_DOWN
            }

            // Update current mask dpad bits
            val nonDpad = currentMask and (
                PS1InputFrame.BTN_UP or 
                PS1InputFrame.BTN_DOWN or 
                PS1InputFrame.BTN_LEFT or 
                PS1InputFrame.BTN_RIGHT
            ).inv()

            currentMask = nonDpad or dpadMask
            return true
        }
        return false
    }

    fun getCurrentInputMask(): Int = currentMask

    fun remapButton(androidKeyCode: Int, ps1Bitmask: Int) {
        keyMapping[androidKeyCode] = ps1Bitmask
    }

    fun resetMappingsToDefault() {
        keyMapping.clear()
        keyMapping[KeyEvent.KEYCODE_BUTTON_A] = PS1InputFrame.BTN_CROSS
        keyMapping[KeyEvent.KEYCODE_BUTTON_B] = PS1InputFrame.BTN_CIRCLE
        keyMapping[KeyEvent.KEYCODE_BUTTON_X] = PS1InputFrame.BTN_SQUARE
        keyMapping[KeyEvent.KEYCODE_BUTTON_Y] = PS1InputFrame.BTN_TRIANGLE
        keyMapping[KeyEvent.KEYCODE_BUTTON_L1] = PS1InputFrame.BTN_L1
        keyMapping[KeyEvent.KEYCODE_BUTTON_R1] = PS1InputFrame.BTN_R1
        keyMapping[KeyEvent.KEYCODE_BUTTON_L2] = PS1InputFrame.BTN_L2
        keyMapping[KeyEvent.KEYCODE_BUTTON_R2] = PS1InputFrame.BTN_R2
        keyMapping[KeyEvent.KEYCODE_BUTTON_SELECT] = PS1InputFrame.BTN_SELECT
        keyMapping[KeyEvent.KEYCODE_BUTTON_START] = PS1InputFrame.BTN_START
        keyMapping[KeyEvent.KEYCODE_DPAD_UP] = PS1InputFrame.BTN_UP
        keyMapping[KeyEvent.KEYCODE_DPAD_DOWN] = PS1InputFrame.BTN_DOWN
        keyMapping[KeyEvent.KEYCODE_DPAD_LEFT] = PS1InputFrame.BTN_LEFT
        keyMapping[KeyEvent.KEYCODE_DPAD_RIGHT] = PS1InputFrame.BTN_RIGHT
    }
}
