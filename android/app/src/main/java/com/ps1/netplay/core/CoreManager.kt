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
            Log.e(tag, lastUserError + ": ${packagedCore.absolutePath}")
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

        // Mortal Kombat Trilogy [U] is a USA release. PCSX ReARMed accepts
        // SCPH1001.BIN, which is the BIOS the user already supplied.
        // Keep the IMG as the entry point: PCSX ReARMed supports .img directly.
        val extension = file.extension.lowercase()
        val actualPath = when (extension) {
            "img", "bin", "iso", "cue", "ccd", "chd", "pbp" -> file.absolutePath
            else -> {
                lastUserError = "صيغة PS1 غير مدعومة: .$extension"
                return false
            }
        }

        isGameLoaded = NativeCoreBridge.safeLoadGame(actualPath)
        if (!isGameLoaded) lastUserError = NativeCoreBridge.lastError().ifBlank { "محرك PS1 رفض صورة اللعبة" }
        return isGameLoaded
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
