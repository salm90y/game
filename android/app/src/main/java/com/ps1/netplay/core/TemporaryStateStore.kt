package com.ps1.netplay.core

import android.content.Context
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.CRC32

/**
 * Session-only state storage. Corrupt/incompatible state files are removed automatically.
 * The file lives under cacheDir, so Android may safely remove it at any time.
 */
class TemporaryStateStore(context: Context) {
    private val file = File(File(context.cacheDir, "ps1_netplay"), "state.bin")

    fun clear() {
        runCatching { file.delete() }
    }

    fun save(state: ByteArray): Boolean {
        if (state.isEmpty() || state.size > MAX_STATE_BYTES) return false
        return runCatching {
            val parent = file.parentFile ?: return false
            if (!parent.exists()) parent.mkdirs()
            val crc = CRC32().apply { update(state) }.value.toInt()
            val tmp = File(parent, "state.bin.tmp")
            FileOutputStream(tmp).use { out ->
                val header = ByteBuffer.allocate(12).order(ByteOrder.BIG_ENDIAN)
                    .putInt(MAGIC).putInt(state.size).putInt(crc).array()
                out.write(header)
                out.write(state)
                out.fd.sync()
            }
            if (!tmp.renameTo(file)) {
                tmp.delete()
                return false
            }
            true
        }.getOrElse {
            clear()
            false
        }
    }

    fun load(): ByteArray? {
        if (!file.isFile || file.length() < HEADER_BYTES || file.length() > MAX_STATE_BYTES + HEADER_BYTES) {
            clear()
            return null
        }
        return runCatching {
            FileInputStream(file).use { input ->
                val header = ByteArray(HEADER_BYTES)
                if (input.read(header) != HEADER_BYTES) return null
                val bb = ByteBuffer.wrap(header).order(ByteOrder.BIG_ENDIAN)
                val magic = bb.int
                val size = bb.int
                val expectedCrc = bb.int
                if (magic != MAGIC || size <= 0 || size > MAX_STATE_BYTES) {
                    clear()
                    return null
                }
                val state = ByteArray(size)
                var offset = 0
                while (offset < size) {
                    val n = input.read(state, offset, size - offset)
                    if (n <= 0) {
                        clear()
                        return null
                    }
                    offset += n
                }
                val actualCrc = CRC32().apply { update(state) }.value.toInt()
                if (actualCrc != expectedCrc) {
                    clear()
                    return null
                }
                state
            }
        }.getOrElse {
            clear()
            null
        }
    }

    companion object {
        private const val MAGIC = 0x43334E50 // C3NP
        private const val HEADER_BYTES = 12
        private const val MAX_STATE_BYTES = 64 * 1024 * 1024
    }
}
