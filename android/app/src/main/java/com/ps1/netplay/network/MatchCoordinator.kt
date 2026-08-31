package com.ps1.netplay.network

import com.ps1.netplay.core.NativeCoreBridge
import java.util.concurrent.ConcurrentHashMap

/**
 * Coordinates game frames, synchronized input, prediction and native execution.
 */
class MatchCoordinator(
    private val isHost: Boolean,
    private val transport: PeerTransport?
) {
    private var currentFrame: Long = 0
    private val remoteInputBuffer = ConcurrentHashMap<Long, Int>()
    private var lastConfirmedRemoteInput: Int = 0

    init {
        transport?.setOnInputReceivedListener { frameIndex, inputMask ->
            remoteInputBuffer[frameIndex] = inputMask
            lastConfirmedRemoteInput = inputMask
        }
    }

    fun tickFrame(localInputMask: Int) {
        currentFrame++
        transport?.sendFrameInput(currentFrame, localInputMask)

        val remoteInputMask = remoteInputBuffer.remove(currentFrame) ?: lastConfirmedRemoteInput
        val (p1Mask, p2Mask) = if (isHost) {
            Pair(localInputMask, remoteInputMask)
        } else {
            Pair(remoteInputMask, localInputMask)
        }

        // Do not invoke JNI until the native library is actually available.
        if (NativeCoreBridge.isAvailable()) {
            NativeCoreBridge.safeRunFrame(p1Mask, p2Mask)
        }
    }

    fun getCurrentFrameNumber(): Long = currentFrame

    fun reset() {
        currentFrame = 0
        remoteInputBuffer.clear()
        lastConfirmedRemoteInput = 0
    }
}
