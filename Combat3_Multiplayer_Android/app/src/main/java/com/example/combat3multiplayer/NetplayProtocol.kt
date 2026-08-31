package com.example.combat3multiplayer

data class HelloPacket(val room:String,val gameHash:String,val protocol:Int=1)
data class AckPacket(val frame:Long)
data class PingPacket(val sentAtMs:Long)

object NetplayProtocol {
    fun hello(p:HelloPacket)="HELLO|${p.room}|${p.gameHash}|${p.protocol}"
    fun ack(p:AckPacket)="ACK|${p.frame}"
    fun ping(p:PingPacket)="PING|${p.sentAtMs}"
}
