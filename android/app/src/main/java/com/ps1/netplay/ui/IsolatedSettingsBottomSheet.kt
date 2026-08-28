package com.ps1.netplay.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.ps1.netplay.R

/**
 * Isolated Settings Panel accessible via discrete gear button
 * Categories: Controller, Gamepad, Network, Audio, Display, Memory Card, Players, Leave Room
 */
class IsolatedSettingsBottomSheet : BottomSheetDialogFragment() {

    var onLeaveRoomClicked: (() -> Unit)? = null
    var onResetMappingClicked: (() -> Unit)? = null
    var onLoadRomClicked: (() -> Unit)? = null
    var onLoadBiosClicked: (() -> Unit)? = null
    var currentRomTitle: String = "Combat 3 (Built-in)"
    var currentBiosTitle: String = "HLE High-Level Emulation (تلقائي)"

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_isolated_settings, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        view.findViewById<TextView>(R.id.txt_rom_status)?.text =
            getString(R.string.status_current_rom, currentRomTitle)

        view.findViewById<TextView>(R.id.txt_bios_status)?.text =
            getString(R.string.status_current_bios, currentBiosTitle)

        view.findViewById<Button>(R.id.btn_load_rom)?.setOnClickListener {
            onLoadRomClicked?.invoke()
            dismiss()
        }

        view.findViewById<Button>(R.id.btn_load_bios)?.setOnClickListener {
            onLoadBiosClicked?.invoke()
            dismiss()
        }

        view.findViewById<Button>(R.id.btn_leave_room)?.setOnClickListener {
            onLeaveRoomClicked?.invoke()
            dismiss()
        }

        view.findViewById<Button>(R.id.btn_reset_controls)?.setOnClickListener {
            onResetMappingClicked?.invoke()
        }

        view.findViewById<View>(R.id.btn_close_settings)?.setOnClickListener {
            dismiss()
        }
    }

    companion object {
        const val TAG = "IsolatedSettings"
        fun newInstance(): IsolatedSettingsBottomSheet = IsolatedSettingsBottomSheet()
    }
}
