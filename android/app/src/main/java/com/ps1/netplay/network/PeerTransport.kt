package com.ps1.netplay.network

/**
 * Low-latency P2P Transport Interface (WebRTC DataChannel or Direct UDP Socket)
 */
interface PeerTransport {
    fun sendFrameInput(frameIndex: Long, inputMask: Int)
    fun setOnInputReceivedListener(listener: (frameIndex: Long, inputMask: Int) -> Unit)
    fun setOnConnectionStateListener(listener: (connected: Boolean, pingMs: Long) -> Unit)
    fun disconnect()
}
