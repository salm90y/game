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
            Log.e(tag, "JNI bridge is unavailable")
            return false
        }
        val systemDir = File(context.filesDir, "system")
        val saveDir = File(context.filesDir, "saves")
        if ((!systemDir.exists() && !systemDir.mkdirs()) || (!saveDir.exists() && !saveDir.mkdirs())) {
            Log.e(tag, "Unable to create Libretro writable directories")
            return false
        }
        NativeCoreBridge.safeSetDirectories(systemDir.absolutePath, saveDir.absolutePath)

        val packagedCore = File(context.applicationInfo.nativeLibraryDir, coreFileName)
        if (!packagedCore.isFile || packagedCore.length() == 0L) {
            Log.e(tag, "PS1 Libretro core is missing from APK: ${packagedCore.absolutePath}")
            return false
        }
        isCoreLoaded = NativeCoreBridge.safeLoadCore(packagedCore.absolutePath)
        Log.i(tag, "Libretro core load=$isCoreLoaded path=${packagedCore.absolutePath}")
        return isCoreLoaded
    }

    fun loadGame(romPath: String): Boolean {
        if (!isCoreLoaded && !loadCore()) return false
        val actualPath = resolvePs1EntryPoint(romPath) ?: return false
        isGameLoaded = NativeCoreBridge.safeLoadGame(actualPath)
        Log.i(tag, "Game load=$isGameLoaded path=$actualPath")
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
        cueFile.writeText(
            "FILE \"${imageFile.name.replace("\"", "\\\"")}\" BINARY\n" +
                "  TRACK 01 MODE2/2352\n" +
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
            FileOutputStream(biosFile).use { output -> sourceInputStream.copyTo(output) }
            Log.i(tag, "BIOS saved: ${biosFile.absolutePath}")
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
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM", e)
            false
        }
    }

    fun unload() {
        if (isGameLoaded || isCoreLoaded) NativeCoreBridge.safeUnloadGame()
        isGameLoaded = false
        isCoreLoaded = false
    }
}
