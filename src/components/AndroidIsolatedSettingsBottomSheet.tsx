import React, { useState } from 'react';
import { soundFx } from '../services/audioSynthesizer';
import { GameROM } from '../types';
import { ROMInspector } from '../services/romInspector';

interface AndroidIsolatedSettingsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeRom: GameROM;
  onSelectRom: (rom: GameROM) => void;
  onResetControls: () => void;
  onLeaveRoom: () => void;
  onOpenAdvancedSettings: () => void;
}

/**
 * AndroidIsolatedSettingsBottomSheet
 * 
 * واجهة BottomSheet أندرويد حقيقية ومطابقة 100% لملف:
 * /android/app/src/main/res/layout/dialog_isolated_settings.xml
 * و /android/app/src/main/java/com/ps1/netplay/ui/IsolatedSettingsBottomSheet.kt
 */
export const AndroidIsolatedSettingsBottomSheet: React.FC<AndroidIsolatedSettingsBottomSheetProps> = ({
  isOpen,
  onClose,
  activeRom,
  onSelectRom,
  onResetControls,
  onLeaveRoom,
  onOpenAdvancedSettings
}) => {
  const [customBiosName, setCustomBiosName] = useState<string>('HLE High-Level Emulation (تلقائي)');
  const [isLoadingRom, setIsLoadingRom] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showAndroidToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleRomSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingRom(true);
    soundFx.playUiBlip(750);
    try {
      const inspected = await ROMInspector.inspectFile(file);
      onSelectRom(inspected);
      soundFx.playPs1Boot();
      showAndroidToast(`تم تحميل اللعبة بنجاح: ${file.name}`);
    } catch (err) {
      console.error(err);
      showAndroidToast('تعذر قراءة ملف اللعبة المحدد');
    } finally {
      setIsLoadingRom(false);
    }
  };

  const handleBiosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    soundFx.playUiBlip(880);
    setCustomBiosName(file.name);
    showAndroidToast(`تم حفظ البيوس المخصص: ${file.name}`);
  };

  return (
    <div 
      id="android-bottomsheet-scrim"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      {/* Android Toast Bubble */}
      {toastMessage && (
        <div 
          id="android-native-toast"
          className="fixed top-8 z-60 bg-slate-800/95 text-slate-100 px-5 py-2.5 rounded-full text-xs font-mono border border-slate-700 shadow-2xl animate-bounce"
        >
          🤖 {toastMessage}
        </div>
      )}

      {/* Android BottomSheet Dialog Box matching dialog_isolated_settings.xml */}
      <div 
        id="dialog_isolated_settings"
        className="w-full max-w-lg bg-[#0F172A] border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col text-slate-200 overflow-y-auto max-h-[85vh]"
        onClick={e => e.stopPropagation()}
        style={{ direction: 'rtl' }}
      >
        {/* Top Drag Indicator (Android BottomSheet Handle) */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 self-center sm:hidden" />

        {/* 1. Header matching RelativeLayout in XML */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-lg font-bold text-[#F8FAFC]">
                لوحة الإعدادات المعزولة
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              IsolatedSettingsBottomSheet.kt • PS1 Netplay
            </p>
          </div>

          <button
            id="btn_close_settings"
            onClick={() => {
              soundFx.playUiBlip(600);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 2. ROM & BIOS Section (cat_rom_bios) */}
        <div className="space-y-3 mb-5">
          <div className="text-sm font-bold text-[#34D399] flex items-center gap-1.5">
            <span>💾</span>
            <span>إدارة ملفات اللعبة والبيوس (ROM & BIOS)</span>
          </div>

          {/* Button: btn_load_rom */}
          <label 
            id="btn_load_rom"
            className="w-full py-3 px-4 bg-[#065F46] hover:bg-[#047857] active:bg-[#064E3B] text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <span>📂</span>
            <span>{isLoadingRom ? 'جاري فتح وتثبيت اللعبة...' : 'إضافة / تحميل لعبة PS1 (.iso / .bin / .chd / .cue)'}</span>
            <input 
              type="file" 
              accept=".iso,.bin,.chd,.cue,.pbp,.img" 
              onChange={handleRomSelected} 
              className="hidden" 
            />
          </label>

          {/* TextView: txt_rom_status */}
          <div 
            id="txt_rom_status"
            className="text-xs text-[#94A3B8] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center"
          >
            <span className="text-slate-400">اللعبة الحالية:</span>
            <span className="text-emerald-400 font-bold truncate max-w-[240px]">
              {activeRom.title}
            </span>
          </div>

          {/* Button: btn_load_bios */}
          <label 
            id="btn_load_bios"
            className="w-full py-2.5 px-4 bg-[#1E293B] hover:bg-[#334155] active:bg-[#0F172A] text-white font-bold rounded-xl text-xs sm:text-sm border border-slate-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <span>⚡</span>
            <span>إضافة ملف BIOS مخصص (SCPH1001.bin / SCPH5501.bin)</span>
            <input 
              type="file" 
              accept=".bin,.rom,.bios" 
              onChange={handleBiosSelected} 
              className="hidden" 
            />
          </label>

          {/* TextView: txt_bios_status */}
          <div 
            id="txt_bios_status"
            className="text-xs text-[#94A3B8] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center"
          >
            <span className="text-slate-400">البيوس الحالي:</span>
            <span className="text-sky-400 font-bold truncate max-w-[240px]">
              {customBiosName}
            </span>
          </div>
        </div>

        {/* Divider View */}
        <div className="h-[1px] bg-[#334155] w-full my-1" />

        {/* 3. Controller Settings Section (cat_controller_gamepad) */}
        <div className="space-y-3 my-4">
          <div className="text-sm font-bold text-[#38BDF8] flex items-center gap-1.5">
            <span>🎮</span>
            <span>يد التحكم (Gamepad OTG / Bluetooth)</span>
          </div>

          {/* Button: btn_reset_controls */}
          <button
            id="btn_reset_controls"
            onClick={() => {
              soundFx.playUiBlip(750);
              onResetControls();
              showAndroidToast('تمت إعادة تعيين أزرار التحكم للافتراضي');
            }}
            className="w-full py-2.5 px-4 bg-[#1E293B] hover:bg-[#334155] text-white font-bold rounded-xl text-xs sm:text-sm border border-slate-700 cursor-pointer shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>🔄</span>
            <span>إعادة تعيين أزرار التحكم إلى الافتراضي</span>
          </button>
        </div>

        {/* Divider View */}
        <div className="h-[1px] bg-[#334155] w-full my-1" />

        {/* 4. Advanced / Netplay Navigation Button */}
        <div className="my-3">
          <button
            id="btn_open_advanced_settings"
            onClick={() => {
              soundFx.playUiBlip(850);
              onOpenAdvancedSettings();
            }}
            className="w-full py-2.5 px-4 bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-200 border border-indigo-700/60 font-bold rounded-xl text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            <span>⚙️</span>
            <span>عرض تفاصيل الشبكة Netplay وضبط الصوت والشاشة المتقدم</span>
          </button>
        </div>

        {/* 5. Leave Room Button (btn_leave_room) */}
        <div className="mt-2">
          <button
            id="btn_leave_room"
            onClick={() => {
              soundFx.playUiBlip(500);
              onLeaveRoom();
              onClose();
            }}
            className="w-full py-3 px-4 bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <span>🚪</span>
            <span>مغادرة الغرفة وإنهاء الجلسة</span>
          </button>
        </div>

      </div>
    </div>
  );
};
