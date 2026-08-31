package com.example.combat3multiplayer

class NetplayClock {
    private var remoteFrame=-1L
    fun acceptRemote(frame:Long):Boolean {
        if(frame<=remoteFrame) return false
        remoteFrame=frame
        return true
    }
    fun latestRemoteFrame():Long=remoteFrame
}
