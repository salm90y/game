package com.ps1.netplay.core

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class CoreManager(private val context: Context) {
    private val tag = "CoreManager"
    private var isCoreLoaded = false
    private var isGameLoaded = false

    /** Initializes and extracts/loads the PS1 core when one is available. */
    fun loadCore(coreFileName: String = "mednafen_psx_hw_libretro_android.so"): Boolean {
        if (!NativeCoreBridge.isAvailable()) {
            Log.w(tag, "Native bridge is unavailable; keeping application open without emulation")
            return false
        }

        val coreDir = File(context.filesDir, "cores")
        if (!coreDir.exists() && !coreDir.mkdirs()) {
            Log.e(tag, "Unable to create core directory")
            return false
        }

        val coreFile = File(coreDir, coreFileName)
        if (!coreFile.exists()) {
            try {
                context.assets.open("cores/$coreFileName").use { input ->
                    FileOutputStream(coreFile).use { output -> input.copyTo(output) }
                }
                coreFile.setExecutable(true, false)
            } catch (e: Exception) {
                Log.w(tag, "Core asset not found: ${e.message}")
            }
        }

        val targetPath = if (coreFile.isFile && coreFile.length() > 0L) {
            coreFile.absolutePath
        } else {
            coreFileName
        }

        isCoreLoaded = NativeCoreBridge.safeLoadCore(targetPath)
        Log.i(tag, "Libretro core load status for $targetPath: $isCoreLoaded")
        return isCoreLoaded
    }

    fun loadGame(romPath: String): Boolean {
        if (!isCoreLoaded && !loadCore()) return false
        isGameLoaded = NativeCoreBridge.safeLoadGame(romPath)
        Log.i(tag, "Game loaded from $romPath: $isGameLoaded")
        return isGameLoaded
    }

    fun saveCustomBios(sourceInputStream: java.io.InputStream, targetFileName: String): Boolean {
        return try {
            val systemDir = File(context.filesDir, "system")
            if (!systemDir.exists() && !systemDir.mkdirs()) return false
            val safeName = File(targetFileName).name
            val biosFile = File(systemDir, safeName)
            FileOutputStream(biosFile).use { output -> sourceInputStream.copyTo(output) }
            Log.i(tag, "Custom BIOS saved successfully to ${biosFile.absolutePath}")
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
            FileOutputStream(romFile).use { output -> sourceInputStream.copyTo(output) }
            Log.i(tag, "Custom ROM imported to ${romFile.absolutePath}")
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM", e)
            false
        }
    }

    fun unload() {
        if (isGameLoaded || isCoreLoaded) {
            NativeCoreBridge.safeUnloadGame()
        }
        isGameLoaded = false
        isCoreLoaded = false
    }
}
