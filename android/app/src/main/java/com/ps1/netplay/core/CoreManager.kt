package com.ps1.netplay.core

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileOutputStream

class CoreManager(private val context: Context) {
    private val tag = "CoreManager"
    private var isCoreLoaded = false
    private var isGameLoaded = false
    private var lastUserError = ""

    fun loadCore(coreFileName: String = "libpcsx_rearmed_libretro_android.so"): Boolean {
        lastUserError = ""
        if (!NativeCoreBridge.ensureLoaded()) {
            lastUserError = "محرك PS1 الأصلي لم يتم تحميله"
            return false
        }
        val systemDir = File(context.filesDir, "system")
        val saveDir = File(context.filesDir, "saves")
        if (!systemDir.exists() && !systemDir.mkdirs()) {
            lastUserError = "تعذر إنشاء مجلد BIOS"
            return false
        }
        if (!saveDir.exists() && !saveDir.mkdirs()) {
            lastUserError = "تعذر إنشاء مجلد الحفظ"
            return false
        }
        if (!NativeCoreBridge.safeSetDirectories(systemDir.absolutePath, saveDir.absolutePath)) {
            lastUserError = NativeCoreBridge.lastError().ifBlank { "تعذر إعداد مجلدات محرك PS1" }
            return false
        }
        val packagedCore = File(context.applicationInfo.nativeLibraryDir, coreFileName)
        if (!packagedCore.isFile || packagedCore.length() == 0L) {
            lastUserError = "محرك PS1 غير موجود داخل APK"
            Log.e(tag, "$lastUserError: ${packagedCore.absolutePath}")
            return false
        }
        isCoreLoaded = NativeCoreBridge.safeLoadCore(packagedCore.absolutePath)
        if (!isCoreLoaded) lastUserError = NativeCoreBridge.lastError().ifBlank { "تعذر تهيئة محرك PS1" }
        return isCoreLoaded
    }

    fun loadGame(romPath: String): Boolean {
        lastUserError = ""
        if (!isCoreLoaded && !loadCore()) return false
        val file = File(romPath)
        if (!file.isFile || file.length() < 2352L) {
            lastUserError = "ملف صورة القرص غير صالح أو ناقص"
            return false
        }

        // PCSX ReARMed officially supports IMG/CCD, but its Libretro frontend
        // expects a cue sheet describing CD track layout. When the user selects
        // the IMG from a CloneCD set, generate a matching single-track CUE next
        // to the imported image and load the CUE entry point.
        val actualPath = when (file.extension.lowercase()) {
            "img" -> {
                val cue = File(file.parentFile, file.nameWithoutExtension + ".cue")
                if (!cue.isFile || cue.length() == 0L) {
                    if (!createCueForRawPs1Image(file, cue)) {
                        lastUserError = "تعذر إنشاء ملف CUE لصورة القرص"
                        return false
                    }
                }
                cue.absolutePath
            }
            "bin" -> {
                val cue = File(file.parentFile, file.nameWithoutExtension + ".cue")
                if (!cue.isFile || cue.length() == 0L) {
                    if (!createCueForRawPs1Image(file, cue)) {
                        lastUserError = "تعذر إنشاء ملف CUE لصورة القرص"
                        return false
                    }
                }
                cue.absolutePath
            }
            "cue", "ccd", "iso", "chd", "pbp", "m3u" -> file.absolutePath
            else -> {
                lastUserError = "صيغة PS1 غير مدعومة: .${file.extension}"
                return false
            }
        }

        isGameLoaded = NativeCoreBridge.safeLoadGame(actualPath)
        if (!isGameLoaded) {
            lastUserError = NativeCoreBridge.lastError().ifBlank { "محرك PS1 رفض صورة اللعبة" }
        }
        return isGameLoaded
    }

    private fun createCueForRawPs1Image(imageFile: File, cueFile: File): Boolean {
        return try {
            // 2352-byte raw sectors are the normal CloneCD/PS1 IMG layout.
            // MODE2/2352 is the appropriate descriptor for a raw PS1 data track.
            if (imageFile.length() % 2352L != 0L) return false
            val escaped = imageFile.name.replace("\"", "\\\"")
            cueFile.writeText(
                "FILE \"$escaped\" BINARY\n" +
                    "  TRACK 01 MODE2/2352\n" +
                    "    INDEX 01 00:00:00\n",
                Charsets.US_ASCII
            )
            cueFile.isFile && cueFile.length() > 0L
        } catch (e: Exception) {
            Log.e(tag, "Failed to create CUE", e)
            false
        }
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
            lastUserError = "تعذر حفظ BIOS: ${e.javaClass.simpleName}"
            false
        }
    }

    fun importAndLoadRom(sourceInputStream: java.io.InputStream, originalFileName: String): Boolean {
        return try {
            val romsDir = File(context.filesDir, "roms")
            if (!romsDir.exists() && !romsDir.mkdirs()) {
                lastUserError = "تعذر إنشاء مجلد الألعاب"
                return false
            }
            val safeName = File(originalFileName).name
            val romFile = File(romsDir, safeName)
            FileOutputStream(romFile).use { output -> sourceInputStream.copyTo(output, DEFAULT_BUFFER_SIZE) }
            Log.i(tag, "ROM imported: ${romFile.absolutePath} (${romFile.length()} bytes)")
            loadGame(romFile.absolutePath)
        } catch (e: Exception) {
            Log.e(tag, "Failed to import ROM", e)
            lastUserError = "تعذر نسخ ملف اللعبة: ${e.javaClass.simpleName}"
            false
        }
    }

    fun getLastError(): String = lastUserError.ifBlank { NativeCoreBridge.lastError() }

    fun unload() {
        if (isGameLoaded || isCoreLoaded) NativeCoreBridge.safeUnloadGame()
        isGameLoaded = false
        isCoreLoaded = false
    }
}
