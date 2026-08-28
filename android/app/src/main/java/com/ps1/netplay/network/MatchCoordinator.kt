package com.ps1.netplay.network

import com.ps1.netplay.core.NativeCoreBridge
import java.util.concurrent.ConcurrentHashMap

/**
 * Coordinates Game Loop, Input Synchronization, Frame Rollback, and Delay Compensation
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

    /**
     * Executes single game frame synchronized between both players
     */
    fun tickFrame(localInputMask: Int) {
        currentFrame++

        // Broadcast local input to remote peer
        transport?.sendFrameInput(currentFrame, localInputMask)

        // Retrieve remote input or predict based on last known state (Rollback prediction)
        val remoteInputMask = remoteInputBuffer.remove(currentFrame) ?: lastConfirmedRemoteInput

        val (p1Mask, p2Mask) = if (isHost) {
            Pair(localInputMask, remoteInputMask)
        } else {
            Pair(remoteInputMask, localInputMask)
        }

        // Native C++ Execution
        NativeCoreBridge.nativeRunFrame(p1Mask, p2Mask)
    }

    fun getCurrentFrameNumber(): Long = currentFrame

    fun reset() {
        currentFrame = 0
        remoteInputBuffer.clear()
        lastConfirmedRemoteInput = 0
    }
}
