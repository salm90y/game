package com.ps1.netplay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.ImageButton
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ps1.netplay.core.CoreManager
import com.ps1.netplay.input.GamepadManager
import com.ps1.netplay.network.MatchCoordinator
import com.ps1.netplay.network.NetplaySession
import com.ps1.netplay.ui.GameSurfaceView
import com.ps1.netplay.ui.IsolatedSettingsBottomSheet
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    private lateinit var gameSurfaceView: GameSurfaceView
    private lateinit var btnSettings: ImageButton
    private val gamepadManager = GamepadManager()
    private lateinit var coreManager: CoreManager
    private val netplaySession = NetplaySession()
    private var matchCoordinator: MatchCoordinator? = null

    private var currentRomName = "Combat 3 (Built-in)"
    private var currentBiosName = "HLE High-Level Emulation (تلقائي)"

    // File Pickers using Android SAF (Storage Access Framework)
    private val romPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { handleRomSelected(it) }
    }

    private val biosPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { handleBiosSelected(it) }
    }

    private val activityScope = CoroutineScope(Dispatchers.Default + Job())
    private var isGameRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemUI()

        setContentView(R.layout.activity_main)

        gameSurfaceView = findViewById(R.id.game_surface_view)
        btnSettings = findViewById(R.id.btn_discrete_settings)

        coreManager = CoreManager(this)
        coreManager.loadCore()

        // Handle Deep link or Auto room
        val data = intent?.data
        val roomParam = data?.getQueryParameter("room")
        if (!roomParam.isNullOrEmpty()) {
            netplaySession.joinRoom(roomParam)
        }

        matchCoordinator = MatchCoordinator(
            isHost = netplaySession.currentRoom?.isHost ?: true,
            transport = netplaySession.getTransport()
        )

        btnSettings.setOnClickListener {
            openIsolatedSettings()
        }

        startGameLoop()
    }

    private fun startGameLoop() {
        isGameRunning = true
        activityScope.launch {
            val frameTimeNs = 16_666_666L // ~60 FPS
            while (isGameRunning) {
                val startNs = System.nanoTime()

                val localInput = gamepadManager.getCurrentInputMask()
                matchCoordinator?.tickFrame(localInput)

                val elapsedNs = System.nanoTime() - startNs
                val sleepNs = frameTimeNs - elapsedNs
                if (sleepNs > 0) {
                    delay(sleepNs / 1_000_000L)
                }
            }
        }
    }

    private fun openIsolatedSettings() {
        val dialog = IsolatedSettingsBottomSheet.newInstance()
        dialog.currentRomTitle = currentRomName
        dialog.currentBiosTitle = currentBiosName
        dialog.onLoadRomClicked = {
            // Allows selecting PS1 game formats (.iso, .bin, .chd, .cue, .pbp)
            romPickerLauncher.launch("*/*")
        }
        dialog.onLoadBiosClicked = {
            // Allows selecting PlayStation BIOS files (SCPH1001.bin, etc.)
            biosPickerLauncher.launch("*/*")
        }
        dialog.onLeaveRoomClicked = {
            netplaySession.leaveRoom()
            finish()
        }
        dialog.onResetMappingClicked = {
            gamepadManager.resetMappingsToDefault()
        }
        dialog.show(supportFragmentManager, IsolatedSettingsBottomSheet.TAG)
    }

    private fun handleRomSelected(uri: Uri) {
        val fileName = getFileNameFromUri(uri) ?: "game_${System.currentTimeMillis()}.bin"
        contentResolver.openInputStream(uri)?.use { stream ->
            val success = coreManager.importAndLoadRom(stream, fileName)
            if (success) {
                currentRomName = fileName
                Toast.makeText(this, "تم تحميل اللعبة بنجاح: $fileName", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "تعذر تشغيل ملف اللعبة المحدد", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun handleBiosSelected(uri: Uri) {
        val fileName = getFileNameFromUri(uri) ?: "scph1001.bin"
        contentResolver.openInputStream(uri)?.use { stream ->
            val success = coreManager.saveCustomBios(stream, fileName)
            if (success) {
                currentBiosName = fileName
                Toast.makeText(this, "تم حفظ البيوس المخصص: $fileName", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "تعذر حفظ ملف الـ BIOS", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun getFileNameFromUri(uri: Uri): String? {
        var name: String? = null
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex != -1 && cursor.moveToFirst()) {
                name = cursor.getString(nameIndex)
            }
        }
        return name
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (event != null && gamepadManager.onKeyDown(keyCode, event)) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (event != null && gamepadManager.onKeyUp(keyCode, event)) {
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onGenericMotionEvent(event: MotionEvent?): Boolean {
        if (event != null && gamepadManager.onGenericMotionEvent(event)) {
            return true
        }
        return super.onGenericMotionEvent(event)
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isGameRunning = false
        activityScope.cancel()
        coreManager.unload()
    }
}
