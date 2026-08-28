package com.ps1.netplay.core

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class CoreManager(private val context: Context) {

    private val tag = "CoreManager"
    private var isCoreLoaded = false
    private var isGameLoaded = false

    /**
     * Initializes and extracts or loads the PS1 core (.so) from application assets or storage
     */
    fun loadCore(coreFileName: String = "mednafen_psx_hw_libretro_android.so"): Boolean {
        val coreDir = File(context.filesDir, "cores")
        if (!coreDir.exists()) coreDir.mkdirs()

        val coreFile = File(coreDir, coreFileName)
        if (!coreFile.exists()) {
            // Extract core from assets if bundled
            try {
                context.assets.open("cores/$coreFileName").use { input ->
                    FileOutputStream(coreFile).use { output ->
                        input.copyTo(output)
                    }
                }
                coreFile.setExecutable(true, false)
            } catch (e: Exception) {
                Log.w(tag, "Core file asset not found; falling back to dynamic JNI load: ${e.message}")
            }
        }

        val targetPath = if (coreFile.exists()) coreFile.absolutePath else coreFileName
        isCoreLoaded = NativeCoreBridge.nativeLoadCore(targetPath)
        Log.i(tag, "Libretro Core load status for $targetPath: $isCoreLoaded")
        return isCoreLoaded
    }

    fun loadGame(romPath: String): Boolean {
        if (!isCoreLoaded) {
            loadCore()
        }
        isGameLoaded = NativeCoreBridge.nativeLoadGame(romPath)
        Log.i(tag, "Game loaded from $romPath: $isGameLoaded")
        return isGameLoaded
    }

    /**
     * Saves user-selected custom BIOS (e.g. SCPH1001.bin, SCPH5501.bin, SCPH7001.bin)
     */
    fun saveCustomBios(sourceInputStream: java.io.InputStream, targetFileName: String): Boolean {
        return try {
            val systemDir = File(context.filesDir, "system")
            if (!systemDir.exists()) systemDir.mkdirs()
            val biosFile = File(systemDir, targetFileName)
            FileOutputStream(biosFile).use { output ->
                sourceInputStream.copyTo(output)
            }
            Log.i(tag, "Custom BIOS saved successfully to ${biosFile.absolutePath}")
            true
        } catch (e: Exception) {
            Log.e(tag, "Failed to save custom BIOS: ${e.message}")
            false
        }
    }

    /**
     * Copies user-selected PS1 ROM file (.bin / .iso / .chd / .cue / .pbp) to local storage and launches it
     */
    fun importAndLoadRom(sourceInputStream: java.io.InputStream, originalFileName: String): Boolean {
        return try {
            val romsDir = File(context.filesDir, "roms")
            if (!romsDir.exists()) romsDir.mkdirs()
            val romFile = File(romsDir, originalFileName)
            FileOutputStream(romFile).use { output ->
                sourceInputStream.copyTo(output)
            }
            Log.i(tag, "Custom ROM imported to ${romFile.absolutePath}")
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM: ${e.message}")
            false
        }
    }

    fun unload() {
        if (isGameLoaded) {
            NativeCoreBridge.nativeUnloadGame()
            isGameLoaded = false
            isCoreLoaded = false
        }
    }
}
