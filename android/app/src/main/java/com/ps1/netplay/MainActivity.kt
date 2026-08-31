package com.ps1.netplay

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
import com.ps1.netplay.core.TemporaryStateStore
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
    private lateinit var temporaryStateStore: TemporaryStateStore
    private var currentRomName = "Combat 3 (Built-in)"
    private var currentBiosName = "HLE High-Level Emulation (تلقائي)"
    private val activityScope = CoroutineScope(Dispatchers.Default + Job())
    private var isGameRunning = false

    private val romPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? -> uri?.let { handleRomSelected(it) } }
    private val biosPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? -> uri?.let { handleBiosSelected(it) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemUI()
        try {
            setContentView(R.layout.activity_main)
            gameSurfaceView = findViewById(R.id.game_surface_view)
            btnSettings = findViewById(R.id.btn_discrete_settings)
            temporaryStateStore = TemporaryStateStore(this)
            temporaryStateStore.clear()
            coreManager = CoreManager(this)
            val roomParam = intent?.data?.getQueryParameter("room")
            if (!roomParam.isNullOrEmpty()) netplaySession.joinRoom(roomParam)
            matchCoordinator = MatchCoordinator(netplaySession.currentRoom?.isHost ?: true, netplaySession.getTransport())
            btnSettings.setOnClickListener { openIsolatedSettings() }
            // Native PS1 core is loaded only after a ROM is selected.
        } catch (t: Throwable) {
            android.util.Log.e("MainActivity", "Startup failure", t)
            Toast.makeText(this, "تعذر تشغيل الواجهة: ${t.javaClass.simpleName}", Toast.LENGTH_LONG).show()
        }
    }

    private fun startGameLoop() {
        if (isGameRunning) return
        isGameRunning = true
        activityScope.launch {
            val frameTimeNs = 16_666_666L
            while (isGameRunning) {
                val startNs = System.nanoTime()
                matchCoordinator?.tickFrame(gamepadManager.getCurrentInputMask())
                val sleepNs = frameTimeNs - (System.nanoTime() - startNs)
                if (sleepNs > 0) delay(sleepNs / 1_000_000L)
            }
        }
    }

    private fun openIsolatedSettings() {
        val dialog = IsolatedSettingsBottomSheet.newInstance()
        dialog.currentRomTitle = currentRomName
        dialog.currentBiosTitle = currentBiosName
        dialog.onLoadRomClicked = { romPickerLauncher.launch("*/*") }
        dialog.onLoadBiosClicked = { biosPickerLauncher.launch("*/*") }
        dialog.onLeaveRoomClicked = { netplaySession.leaveRoom(); finish() }
        dialog.onResetMappingClicked = { gamepadManager.resetMappingsToDefault() }
        dialog.show(supportFragmentManager, IsolatedSettingsBottomSheet.TAG)
    }

    private fun handleRomSelected(uri: Uri) {
        val fileName = getFileNameFromUri(uri) ?: "game_${System.currentTimeMillis()}.bin"
        contentResolver.openInputStream(uri)?.use { stream ->
            val success = coreManager.importAndLoadRom(stream, fileName)
            if (success) {
                currentRomName = fileName
                temporaryStateStore.clear()
                startGameLoop()
                Toast.makeText(this, "تم تحميل اللعبة بنجاح: $fileName", Toast.LENGTH_SHORT).show()
            } else Toast.makeText(this, "تعذر تشغيل ملف اللعبة المحدد", Toast.LENGTH_LONG).show()
        } ?: Toast.makeText(this, "تعذر قراءة ملف اللعبة", Toast.LENGTH_LONG).show()
    }

    private fun handleBiosSelected(uri: Uri) {
        val fileName = getFileNameFromUri(uri) ?: "scph1001.bin"
        contentResolver.openInputStream(uri)?.use { stream ->
            val success = coreManager.saveCustomBios(stream, fileName)
            if (success) {
                currentBiosName = fileName
                Toast.makeText(this, "تم حفظ البيوس المخصص: $fileName", Toast.LENGTH_SHORT).show()
            } else Toast.makeText(this, "تعذر حفظ ملف الـ BIOS", Toast.LENGTH_LONG).show()
        }
    }

    private fun getFileNameFromUri(uri: Uri): String? {
        var name: String? = null
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index != -1 && cursor.moveToFirst()) name = cursor.getString(index)
        }
        return name
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean = if (event != null && gamepadManager.onKeyDown(keyCode, event)) true else super.onKeyDown(keyCode, event)
    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean = if (event != null && gamepadManager.onKeyUp(keyCode, event)) true else super.onKeyUp(keyCode, event)
    override fun onGenericMotionEvent(event: MotionEvent?): Boolean = if (event != null && gamepadManager.onGenericMotionEvent(event)) true else super.onGenericMotionEvent(event)

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    override fun onDestroy() {
        isGameRunning = false
        activityScope.cancel()
        if (::coreManager.isInitialized) coreManager.unload()
        if (::temporaryStateStore.isInitialized) temporaryStateStore.clear()
        super.onDestroy()
    }
}
