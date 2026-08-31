package com.example.combat3multiplayer

import java.io.File
import java.security.MessageDigest

object GameFingerprint {
    fun sha256(file:File):String {
        val md=MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf=ByteArray(1024*1024)
            var n=input.read(buf)
            while(n>0){ md.update(buf,0,n); n=input.read(buf) }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}
