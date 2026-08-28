package com.ps1.netplay.input

/**
 * Standard 16-bit PS1 Digital / DualShock Bitmask
 */
data class PS1InputFrame(
    val frameIndex: Long = 0,
    val mask: Int = 0,
    val timestamp: Long = System.currentTimeMillis()
) {
    companion object {
        const val BTN_CROSS = 1 shl 0
        const val BTN_CIRCLE = 1 shl 1
        const val BTN_SQUARE = 1 shl 2
        const val BTN_TRIANGLE = 1 shl 3
        const val BTN_L1 = 1 shl 4
        const val BTN_R1 = 1 shl 5
        const val BTN_L2 = 1 shl 6
        const val BTN_R2 = 1 shl 7
        const val BTN_SELECT = 1 shl 8
        const val BTN_START = 1 shl 9
        const val BTN_UP = 1 shl 12
        const val BTN_DOWN = 1 shl 13
        const val BTN_LEFT = 1 shl 14
        const val BTN_RIGHT = 1 shl 15
    }

    fun isPressed(buttonFlag: Int): Boolean {
        return (mask and buttonFlag) != 0
    }
}
