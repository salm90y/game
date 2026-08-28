package com.ps1.netplay.network

import kotlin.random.Random

data class RoomInfo(
    val roomCode: String,
    val isHost: Boolean,
    val peerName: String,
    val pingMs: Long = 0,
    val packetLossPercent: Float = 0.0f
)

class NetplaySession {

    var currentRoom: RoomInfo? = null
        private set

    private var transport: PeerTransport? = null

    /**
     * Generates a 6-character room code (e.g. "PS1X88")
     */
    fun createRoom(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val code = (1..6).map { chars[Random.nextInt(chars.length)] }.joinToString("")
        currentRoom = RoomInfo(
            roomCode = code,
            isHost = true,
            peerName = "Player 1 (Host)"
        )
        return code
    }

    fun joinRoom(roomCode: String): Boolean {
        currentRoom = RoomInfo(
            roomCode = roomCode.uppercase(),
            isHost = false,
            peerName = "Player 2 (Guest)"
        )
        return true
    }

    fun leaveRoom() {
        transport?.disconnect()
        currentRoom = null
    }

    fun setTransport(peerTransport: PeerTransport) {
        this.transport = peerTransport
    }

    fun getTransport(): PeerTransport? = transport
}
