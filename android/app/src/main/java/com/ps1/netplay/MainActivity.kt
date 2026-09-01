package com.ps1.netplay

import android.app.AlertDialog
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.ps1.netplay.core.CoreManager
import com.ps1.netplay.core.NativeCoreBridge
import com.ps1.netplay.core.TemporaryStateStore
import com.ps1.netplay.input.GamepadManager
import com.ps1.netplay.network.MatchCoordinator
import com.ps1.netplay.network.NetplaySession
import com.ps1.netplay.ui.GameSurfaceView
import com.ps1.netplay.ui.IsolatedSettingsBottomSheet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var root: FrameLayout
    private lateinit var gameContainer: FrameLayout
    private lateinit var emptyState: TextView
    private lateinit var btnSettings: ImageButton
    private lateinit var btnChat: Button
    private lateinit var btnConnect: Button
    private lateinit var roomCodeView: TextView
    private lateinit var syncStatusView: TextView
    private var gameSurfaceView: GameSurfaceView? = null
    private var gamepadManager: GamepadManager? = null
    private var coreManager: CoreManager? = null
    private var netplaySession: NetplaySession? = null
    private var matchCoordinator: MatchCoordinator? = null
    private var temporaryStateStore: TemporaryStateStore? = null
    private var romPickerLauncher: ActivityResultLauncher<String>? = null
    private var biosPickerLauncher: ActivityResultLauncher<String>? = null
    private var activityScope: CoroutineScope? = null
    private var currentRomName = "لم يتم اختيار لعبة"
    private var currentBiosName = "HLE / BIOS تلقائي"
    private var isGameRunning = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runCatching { hideSystemUI() }
        try {
            romPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) handleRomSelected(uri) }
            biosPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) handleBiosSelected(uri) }
            setContentView(R.layout.activity_main)
            root = findViewById(R.id.main_root)
            gameContainer = findViewById(R.id.game_view_container)
            emptyState = findViewById(R.id.game_empty_state)
            btnSettings = findViewById(R.id.btn_discrete_settings)
            btnChat = findViewById(R.id.btn_chat)
            btnConnect = findViewById(R.id.btn_connect)
            roomCodeView = findViewById(R.id.txt_room_code)
            syncStatusView = findViewById(R.id.txt_sync_status)

            gamepadManager = GamepadManager()
            coreManager = CoreManager(this)
            netplaySession = NetplaySession()
            temporaryStateStore = TemporaryStateStore(this).also { it.clear() }
            activityScope = CoroutineScope(Dispatchers.Default + Job())

            val roomParam = intent?.data?.getQueryParameter("room")
            if (!roomParam.isNullOrEmpty()) {
                netplaySession?.joinRoom(roomParam)
            } else {
                netplaySession?.createRoom()
            }
            updateRoomUi()
            matchCoordinator = MatchCoordinator(netplaySession?.currentRoom?.isHost ?: true, netplaySession?.getTransport())

            btnSettings.setOnClickListener { openIsolatedSettings() }
            btnChat.setOnClickListener { showRoomChat() }
            btnConnect.setOnClickListener { showRoomInfo() }
        } catch (t: Throwable) {
            android.util.Log.e("MainActivity", "Startup failure", t)
            Toast.makeText(this, "تعذر تهيئة الواجهة: ${t.javaClass.simpleName}", Toast.LENGTH_LONG).show()
        }
    }

    private fun updateRoomUi() {
        val room = netplaySession?.currentRoom
        if (room == null) {
            roomCodeView.text = "ROOM ----"
            syncStatusView.text = "●  لم يتم إنشاء غرفة"
            syncStatusView.setTextColor(Color.rgb(251, 191, 36))
        } else {
            roomCodeView.text = "ROOM ${room.roomCode}"
            syncStatusView.text = if (room.isHost) "●  الغرفة جاهزة • بانتظار اللاعب الآخر" else "●  تم الانضمام • بانتظار المزامنة"
            syncStatusView.setTextColor(Color.rgb(105, 211, 167))
        }
    }

    private fun startGameSurface() {
        if (gameSurfaceView != null) {
            NativeCoreBridge.safeSetSurface(gameSurfaceView?.holder?.surface)
            return
        }
        runCatching {
            val surface = GameSurfaceView(this)
            surface.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            gameContainer.addView(surface, 0)
            gameSurfaceView = surface
            emptyState.visibility = View.GONE
            if (surface.holder.surface.isValid) NativeCoreBridge.safeSetSurface(surface.holder.surface)
        }.onFailure {
            android.util.Log.e("MainActivity", "Surface creation failed", it)
            Toast.makeText(this, "تعذر تشغيل شاشة اللعبة", Toast.LENGTH_LONG).show()
        }
    }

    private fun startGameLoop() {
        if (isGameRunning) return
        isGameRunning = true
        val scope = activityScope ?: return
        scope.launch {
            while (isGameRunning) {
                val startNs = System.nanoTime()
                matchCoordinator?.tickFrame(gamepadManager?.getCurrentInputMask() ?: 0)
                val sleepNs = 16_666_666L - (System.nanoTime() - startNs)
                if (sleepNs > 0) delay(sleepNs / 1_000_000L)
            }
        }
    }

    private fun openIsolatedSettings() {
        runCatching {
            val dialog = IsolatedSettingsBottomSheet.newInstance()
            dialog.currentRomTitle = currentRomName
            dialog.currentBiosTitle = currentBiosName
            dialog.onLoadRomClicked = { romPickerLauncher?.launch("*/*") }
            dialog.onLoadBiosClicked = { biosPickerLauncher?.launch("*/*") }
            dialog.onLeaveRoomClicked = { netplaySession?.leaveRoom(); finish() }
            dialog.onResetMappingClicked = { gamepadManager?.resetMappingsToDefault() }
            dialog.show(supportFragmentManager, IsolatedSettingsBottomSheet.TAG)
        }.onFailure { android.util.Log.e("MainActivity", "Settings failed", it) }
    }

    private fun showRoomInfo() {
        val room = netplaySession?.currentRoom
        if (room == null) {
            netplaySession?.createRoom()
            updateRoomUi()
        }
        val code = netplaySession?.currentRoom?.roomCode ?: "------"
        AlertDialog.Builder(this)
            .setTitle("غرفة المزامنة")
            .setMessage("رمز الغرفة:\n$code\n\nشارك هذا الرمز مع اللاعب الآخر للانضمام.\n\nحالة النقل: في انتظار قناة الاتصال.")
            .setPositiveButton("حسنًا", null)
            .show()
    }

    private fun showRoomChat() {
        if (netplaySession?.currentRoom == null) {
            netplaySession?.createRoom()
            updateRoomUi()
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 20, 28, 8)
            setBackgroundColor(Color.rgb(10, 22, 38))
        }
        val title = TextView(this).apply {
            text = "دردشة غرفة المزامنة  •  ${netplaySession?.currentRoom?.roomCode ?: "------"}"
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.RIGHT
            setPadding(0, 0, 0, 14)
        }
        val messages = TextView(this).apply {
            text = "الغرفة جاهزة.\nأرسل رسالة للاعب الآخر بعد اتصال قناة الغرفة."
            textSize = 14f
            setTextColor(Color.rgb(180, 198, 218))
            gravity = Gravity.RIGHT
            setPadding(0, 12, 0, 12)
        }
        val scroll = ScrollView(this).apply {
            addView(messages)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        val inputRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val input = EditText(this).apply {
            hint = "اكتب رسالة..."
            setHintTextColor(Color.rgb(120, 145, 173))
            setTextColor(Color.WHITE)
            setSingleLine(true)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val send = Button(this).apply {
            text = "إرسال"
            isAllCaps = false
            setOnClickListener {
                val value = input.text?.toString()?.trim().orEmpty()
                if (value.isNotEmpty()) {
                    messages.append("\n\nأنت: $value")
                    input.text?.clear()
                    scroll.post { scroll.fullScroll(View.FOCUS_DOWN) }
                }
            }
        }
        inputRow.addView(input)
        inputRow.addView(send)
        container.addView(title)
        container.addView(scroll)
        container.addView(inputRow)

        AlertDialog.Builder(this)
            .setView(container)
            .setNegativeButton("إغلاق", null)
            .show()
    }

    private fun handleRomSelected(uri: Uri) {
        val manager = coreManager ?: return
        runCatching {
            val fileName = getFileNameFromUri(uri) ?: "game_${System.currentTimeMillis()}.bin"
            contentResolver.openInputStream(uri)?.use { stream ->
                val success = manager.importAndLoadRom(stream, fileName)
                if (success) {
                    currentRomName = fileName
                    temporaryStateStore?.clear()
                    startGameSurface()
                    startGameLoop()
                    Toast.makeText(this, "تم تحميل اللعبة: $fileName", Toast.LENGTH_SHORT).show()
                } else {
                    val detail = manager.getLastError().ifBlank { "سبب غير معروف" }
                    Toast.makeText(this, "تعذر تشغيل اللعبة\n$detail", Toast.LENGTH_LONG).show()
                    android.util.Log.e("MainActivity", "ROM rejected: $detail")
                }
            } ?: Toast.makeText(this, "تعذر قراءة ملف اللعبة", Toast.LENGTH_LONG).show()
        }.onFailure {
            android.util.Log.e("MainActivity", "ROM loading failed", it)
            Toast.makeText(this, "حدث خطأ أثناء تحميل اللعبة: ${it.javaClass.simpleName}", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleBiosSelected(uri: Uri) {
        val manager = coreManager ?: return
        runCatching {
            val fileName = getFileNameFromUri(uri) ?: "SCPH1001.BIN"
            contentResolver.openInputStream(uri)?.use { stream ->
                if (manager.saveCustomBios(stream, fileName)) {
                    currentBiosName = fileName
                    Toast.makeText(this, "تم حفظ BIOS: $fileName", Toast.LENGTH_SHORT).show()
                } else Toast.makeText(this, "تعذر حفظ BIOS", Toast.LENGTH_LONG).show()
            }
        }.onFailure { android.util.Log.e("MainActivity", "BIOS loading failed", it) }
    }

    private fun getFileNameFromUri(uri: Uri): String? = contentResolver.query(uri, null, null, null, null)?.use { cursor ->
        val i = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (i >= 0 && cursor.moveToFirst()) cursor.getString(i) else null
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean = if (event != null && gamepadManager?.onKeyDown(keyCode, event) == true) true else super.onKeyDown(keyCode, event)
    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean = if (event != null && gamepadManager?.onKeyUp(keyCode, event) == true) true else super.onKeyUp(keyCode, event)
    override fun onGenericMotionEvent(event: MotionEvent?): Boolean = if (event != null && gamepadManager?.onGenericMotionEvent(event) == true) true else super.onGenericMotionEvent(event)

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.insetsController?.let { it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()); it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE }
        else @Suppress("DEPRECATION") run { window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE }
    }

    override fun onDestroy() {
        isGameRunning = false
        activityScope?.cancel()
        runCatching { netplaySession?.leaveRoom() }
        runCatching { coreManager?.unload() }
        gameSurfaceView = null
        super.onDestroy()
    }
}
