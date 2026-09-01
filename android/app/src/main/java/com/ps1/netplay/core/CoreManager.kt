package com.ps1.netplay.core

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class CoreManager(private val context: Context) {
    private val tag = "CoreManager"
    private var isCoreLoaded = false
    private var isGameLoaded = false

    fun loadCore(coreFileName: String = "libmednafen_psx_hw_libretro_android.so"): Boolean {
        if (!NativeCoreBridge.ensureLoaded()) {
            Log.e(tag, "JNI bridge unavailable")
            return false
        }

        val systemDir = File(context.filesDir, "system")
        val saveDir = File(context.filesDir, "saves")
        if (!systemDir.exists() && !systemDir.mkdirs()) return false
        if (!saveDir.exists() && !saveDir.mkdirs()) return false

        if (!NativeCoreBridge.safeSetDirectories(systemDir.absolutePath, saveDir.absolutePath)) {
            Log.e(tag, "Failed to set Libretro directories: ${NativeCoreBridge.lastError()}")
            return false
        }

        val packagedCore = File(context.applicationInfo.nativeLibraryDir, coreFileName)
        if (!packagedCore.isFile || packagedCore.length() == 0L) {
            Log.e(tag, "PS1 core missing: ${packagedCore.absolutePath}")
            return false
        }

        isCoreLoaded = NativeCoreBridge.safeLoadCore(packagedCore.absolutePath)
        if (!isCoreLoaded) Log.e(tag, "Core load failed: ${NativeCoreBridge.lastError()}")
        return isCoreLoaded
    }

    fun loadGame(romPath: String): Boolean {
        if (!isCoreLoaded && !loadCore()) return false
        val actualPath = resolvePs1EntryPoint(romPath) ?: run {
            Log.e(tag, "Unsupported/invalid PS1 image: $romPath")
            return false
        }
        isGameLoaded = NativeCoreBridge.safeLoadGame(actualPath)
        if (!isGameLoaded) Log.e(tag, "Game load failed: ${NativeCoreBridge.lastError()}")
        return isGameLoaded
    }

    private fun resolvePs1EntryPoint(path: String): String? {
        val file = File(path)
        if (!file.isFile || file.length() < 2352L) return null
        return when (file.extension.lowercase()) {
            "cue" -> file.absolutePath
            "ccd" -> {
                val img = File(file.parentFile, file.nameWithoutExtension + ".img")
                if (img.isFile && img.length() >= 2352L) file.absolutePath else null
            }
            "img", "bin" -> {
                val cue = File(file.parentFile, file.nameWithoutExtension + ".cue")
                if (!cue.isFile || cue.length() == 0L) createSingleTrackCue(file, cue)
                if (cue.isFile && cue.length() > 0L) cue.absolutePath else null
            }
            else -> null
        }
    }

    private fun createSingleTrackCue(imageFile: File, cueFile: File): Boolean = try {
        // CloneCD IMG files are normally raw 2352-byte sectors. For a 2048-byte
        // sector image, generate the matching MODE1 descriptor instead.
        val mode = if (imageFile.length() % 2352L == 0L) "MODE2/2352" else "MODE1/2048"
        cueFile.writeText(
            "FILE \"${imageFile.name.replace("\"", "\\\"")}\" BINARY\n" +
                "  TRACK 01 $mode\n" +
                "    INDEX 01 00:00:00\n",
            Charsets.US_ASCII
        )
        true
    } catch (e: Exception) {
        Log.e(tag, "Failed to create CUE descriptor", e)
        false
    }

    fun saveCustomBios(sourceInputStream: java.io.InputStream, targetFileName: String): Boolean {
        return try {
            val systemDir = File(context.filesDir, "system")
            if (!systemDir.exists() && !systemDir.mkdirs()) return false
            val biosFile = File(systemDir, File(targetFileName).name)
            FileOutputStream(biosFile).use { output -> sourceInputStream.copyTo(output, DEFAULT_BUFFER_SIZE) }
            Log.i(tag, "BIOS saved: ${biosFile.absolutePath} (${biosFile.length()} bytes)")
            true
        } catch (e: Exception) {
            Log.e(tag, "Failed to save BIOS", e)
            false
        }
    }

    fun importAndLoadRom(sourceInputStream: java.io.InputStream, originalFileName: String): Boolean {
        return try {
            val romsDir = File(context.filesDir, "roms")
            if (!romsDir.exists() && !romsDir.mkdirs()) return false
            val safeName = File(originalFileName).name
            val romFile = File(romsDir, safeName)
            FileOutputStream(romFile).use { output -> sourceInputStream.copyTo(output, DEFAULT_BUFFER_SIZE) }
            Log.i(tag, "ROM imported: ${romFile.absolutePath} (${romFile.length()} bytes)")
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM", e)
            false
        }
    }

    fun getLastError(): String = NativeCoreBridge.lastError()

    fun unload() {
        if (isGameLoaded || isCoreLoaded) NativeCoreBridge.safeUnloadGame()
        isGameLoaded = false
        isCoreLoaded = false
    }
}
