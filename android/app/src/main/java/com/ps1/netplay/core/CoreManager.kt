package com.ps1.netplay.core

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class CoreManager(private val context: Context) {
    private val tag = "CoreManager"
    private var isCoreLoaded = false
    private var isGameLoaded = false

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

        val actualPath = resolvePs1EntryPoint(romPath)
        if (actualPath == null) {
            Log.e(tag, "Unsupported or invalid PS1 image: $romPath")
            return false
        }

        // A raw CloneCD IMG is not a reliable Libretro entry point. Create a
        // standard CUE descriptor beside it so the core can read the disc layout.
        isGameLoaded = NativeCoreBridge.safeLoadGame(actualPath)
        Log.i(tag, "Game load status for $actualPath: $isGameLoaded")
        return isGameLoaded
    }

    /**
     * PS1 images may be supplied as CUE, IMG/BIN, or CloneCD CCD.
     * For a raw IMG/BIN we generate a minimal single-track CUE descriptor.
     * For CCD we currently require the matching IMG to have been imported as well.
     */
    private fun resolvePs1EntryPoint(path: String): String? {
        val file = File(path)
        if (!file.isFile || file.length() == 0L) return null

        return when (file.extension.lowercase()) {
            "cue" -> file.absolutePath
            "img", "bin" -> {
                val cue = File(file.parentFile, file.nameWithoutExtension + ".cue")
                if (!cue.exists() || cue.length() == 0L) {
                    createSingleTrackCue(file, cue)
                }
                if (cue.isFile && cue.length() > 0L) cue.absolutePath else null
            }
            "ccd" -> {
                // CloneCD images need the companion IMG/SUB. If they are already
                // present beside the CCD, generate a compatible CUE entry.
                val img = File(file.parentFile, file.nameWithoutExtension + ".img")
                if (!img.isFile || img.length() == 0L) return null
                val cue = File(file.parentFile, file.nameWithoutExtension + ".cue")
                if (!cue.exists() || cue.length() == 0L) createSingleTrackCue(img, cue)
                if (cue.isFile && cue.length() > 0L) cue.absolutePath else null
            }
            else -> null
        }
    }

    private fun createSingleTrackCue(imageFile: File, cueFile: File): Boolean {
        return try {
            // PS1 CloneCD images are normally raw 2352-byte MODE2 sectors.
            // Quote the basename so spaces/brackets in game titles are valid.
            val cue = buildString {
                append("FILE \"")
                append(imageFile.name.replace("\"", "\\\""))
                append("\" BINARY\n")
                append("  TRACK 01 MODE2/2352\n")
                append("    INDEX 01 00:00:00\n")
            }
            cueFile.writeText(cue, Charsets.UTF_8)
            Log.i(tag, "Created PS1 CUE descriptor: ${cueFile.absolutePath}")
            true
        } catch (e: Exception) {
            Log.e(tag, "Failed to create CUE descriptor", e)
            false
        }
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
            FileOutputStream(romFile).use { output -> inputCopy(sourceInputStream, output) }
            Log.i(tag, "Custom ROM imported to ${romFile.absolutePath}")
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM", e)
            false
        }
    }

    private fun inputCopy(input: java.io.InputStream, output: FileOutputStream) {
        input.copyTo(output, DEFAULT_BUFFER_SIZE)
    }

    fun unload() {
        if (isGameLoaded || isCoreLoaded) NativeCoreBridge.safeUnloadGame()
        isGameLoaded = false
        isCoreLoaded = false
    }
}
