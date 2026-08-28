import React, { useState, useEffect } from 'react';
import { GameROM, DisplaySettings, AudioSettings } from '../types';
import { PS1CombatEngine } from './PS1CombatEngine';
import { VirtualTouchOverlay } from './VirtualTouchOverlay';
import { AndroidIsolatedSettingsBottomSheet } from './AndroidIsolatedSettingsBottomSheet';
import { IsolatedSettingsDrawer } from './IsolatedSettingsDrawer';
import { AndroidNativeArchitectureModal } from './AndroidNativeArchitectureModal';
import { inputManager } from '../services/ps1InputManager';
import { netplayCoordinator } from '../services/netplayCoordinator';
import { soundFx } from '../services/audioSynthesizer';

interface AndroidDeviceSimulatorProps {
  activeRom: GameROM;
  onSelectRom: (rom: GameROM) => void;
  displaySettings: DisplaySettings;
  onUpdateDisplaySettings: (settings: DisplaySettings) => void;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: AudioSettings) => void;
}

type DeviceMode = 'phone_landscape' | 'tablet_landscape' | 'native_fullscreen';
type ViewTab = 'emulator_screen' | 'rom_manager' | 'logcat_console' | 'apk_builder';

interface LogcatEntry {
  id: string;
  time: string;
  level: 'I' | 'D' | 'W' | 'E';
  tag: string;
  message: string;
}

export const AndroidDeviceSimulator: React.FC<AndroidDeviceSimulatorProps> = ({
  activeRom,
  onSelectRom,
  displaySettings,
  onUpdateDisplaySettings,
  audioSettings,
  onUpdateAudioSettings
}) => {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('phone_landscape');
  const [activeTab, setActiveTab] = useState<ViewTab>('emulator_screen');
  const [isAndroidBottomSheetOpen, setIsAndroidBottomSheetOpen] = useState(false);
  const [isAdvancedDrawerOpen, setIsAdvancedDrawerOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [hasPhysicalGamepad, setHasPhysicalGamepad] = useState(false);
  const [matchRestartKey, setMatchRestartKey] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('12:00');
  const [batteryLevel] = useState(98);

  // Real-time simulated Logcat logs
  const [logs, setLogs] = useState<LogcatEntry[]>([
    { id: '1', time: '00:00.012', level: 'I', tag: 'AndroidRuntime', message: '>>> Starting process com.ps1.netplay (PID: 28410) <<<' },
    { id: '2', time: '00:00.045', level: 'I', tag: 'NativeCoreBridge', message: 'System.loadLibrary("ps1_retro_bridge") -> SUCCESS' },
    { id: '3', time: '00:00.068', level: 'I', tag: 'NativeCoreBridge', message: 'JNI_OnLoad registered 14 native Libretro dispatch methods' },
    { id: '4', time: '00:00.092', level: 'D', tag: 'CoreManager', message: 'Checking /data/data/com.ps1.netplay/files/system/ (HLE BIOS active)' },
    { id: '5', time: '00:00.120', level: 'I', tag: 'GameSurfaceView', message: 'SurfaceHolder created: format=RGBA_8888, size=1920x1080' },
    { id: '6', time: '00:00.150', level: 'D', tag: 'OpenGL_ES3', message: 'EGL Context initialized. GL_RENDERER: Adreno / Mali OpenGL ES 3.2' },
    { id: '7', time: '00:00.210', level: 'I', tag: 'ps1_retro_bridge', message: 'retro_load_game: Loaded ROM "Combat 3 Arena" (CRC32: 0x94B2C1A)' },
    { id: '8', time: '00:00.240', level: 'I', tag: 'GamepadManager', message: 'InputDevice detected: Touch virtual pad + Gamepad OTG listener active' },
    { id: '9', time: '00:00.290', level: 'I', tag: 'NetplayCoordinator', message: 'WebRTC DataChannel initialized. Rollback sync buffer: 8 frames' },
    { id: '10', time: '00:00.320', level: 'D', tag: 'ps1_retro_bridge', message: 'retro_run: Rendering 60.00 FPS stable (Frametime: 16.6ms)' },
  ]);

  // Update simulated Android clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      setCurrentTimeStr(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Monitor physical gamepad
  useEffect(() => {
    const unsub = inputManager.onGamepadChange((pad) => {
      const isConnected = pad !== null && pad.connected;
      setHasPhysicalGamepad(isConnected);
      if (isConnected) {
        addLog('I', 'GamepadManager', `Hardware Gamepad attached: "${pad?.id || 'Standard Controller'}"`);
      }
    });
    return unsub;
  }, []);

  const addLog = (level: 'I' | 'D' | 'W' | 'E', tag: string, message: string) => {
    const d = new Date();
    const time = `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs(prev => [...prev.slice(-40), { id: Math.random().toString(), time, level, tag, message }]);
  };

  const isTouchControlsVisible = 
    displaySettings.showTouchControls && 
    !(displaySettings.autoHideControlsOnGamepad && hasPhysicalGamepad);

  return (
    <div 
      id="android-studio-simulator"
      className="w-full h-full flex flex-col bg-[#090D16] text-slate-100 overflow-hidden select-none font-sans"
    >
      {/* 1. Android Studio Top Environment Bar */}
      <header className="h-12 px-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-700/60 px-2.5 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-emerald-300 font-mono">
              Android 14 (API 34)
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="text-slate-600">|</span>
            <span>Package: <strong className="text-slate-200">com.ps1.netplay</strong></span>
            <span className="text-slate-600">|</span>
            <span>Arch: <strong className="text-sky-400">arm64-v8a (C++ NDK)</strong></span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            id="tab-emulator-screen"
            onClick={() => {
              soundFx.playUiBlip(700);
              setActiveTab('emulator_screen');
            }}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'emulator_screen'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📱</span>
            <span>شاشة اللعبة (MainActivity)</span>
          </button>

          <button
            id="tab-logcat-console"
            onClick={() => {
              soundFx.playUiBlip(750);
              setActiveTab('logcat_console');
            }}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logcat_console'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📜</span>
            <span>سجل Logcat و NDK</span>
          </button>

          <button
            id="tab-apk-builder"
            onClick={() => {
              soundFx.playUiBlip(800);
              setIsArchitectureModalOpen(true);
            }}
            className="px-3 py-1 text-xs font-bold rounded-md bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/60 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>📦</span>
            <span>ملفات الأندرويد & GitHub Actions</span>
          </button>
        </div>

        {/* Device Format Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          <button
            title="هاتف أندرويد أفقي (Phone Landscape)"
            onClick={() => setDeviceMode('phone_landscape')}
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              deviceMode === 'phone_landscape' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📱
          </button>
          <button
            title="تابلت أندرويد للألعاب (Gaming Tablet)"
            onClick={() => setDeviceMode('tablet_landscape')}
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              deviceMode === 'tablet_landscape' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📲
          </button>
          <button
            title="شاشة كاملة نقية (Fullscreen Canvas)"
            onClick={() => setDeviceMode('native_fullscreen')}
            className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
              deviceMode === 'native_fullscreen' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🖥️
          </button>
        </div>
      </header>

      {/* 2. Main Stage Area */}
      <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-radial from-slate-900 via-[#090D16] to-[#04070D]">
        
        {/* TAB 1: Live Android Device Running MainActivity & GameSurfaceView */}
        {activeTab === 'emulator_screen' && (
          <div 
            id="android-device-outer-frame"
            className={`relative flex flex-col transition-all duration-300 shadow-2xl bg-black ${
              deviceMode === 'phone_landscape'
                ? 'w-[96vw] max-w-[1020px] aspect-[20/9] rounded-[36px] border-[10px] border-[#1E293B] ring-2 ring-slate-700/60'
                : deviceMode === 'tablet_landscape'
                ? 'w-[96vw] max-w-[1100px] aspect-[16/10] rounded-[28px] border-[14px] border-[#1E293B] ring-2 ring-slate-700/60'
                : 'w-full h-full rounded-none border-0'
            }`}
          >
            {/* Front Camera Punch-hole on Landscape Phone */}
            {deviceMode !== 'native_fullscreen' && (
              <div className="absolute top-1/2 left-3.5 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 z-50 flex items-center justify-center shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0A1128]" />
              </div>
            )}

            {/* Android System Status Bar (Landscape Top) */}
            <div className="h-6 px-7 bg-black/80 backdrop-blur-xs flex items-center justify-between text-[11px] font-mono text-slate-300 z-40 shrink-0 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">{currentTimeStr}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-800/40">
                  PS1 NDK 60fps
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {hasPhysicalGamepad && (
                  <span className="text-[10px] text-sky-400 flex items-center gap-0.5">
                    🎮 <span>OTG Gamepad</span>
                  </span>
                )}
                <span>📶 5G</span>
                <span>📡 Wi-Fi 6</span>
                <span className="text-emerald-400 font-bold">🔋 {batteryLevel}%</span>
              </div>
            </div>

            {/* Android App Viewport: MainActivity + GameSurfaceView */}
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
              
              {/* 3D PS1 Engine Simulation (60 FPS Native Renderer) */}
              <PS1CombatEngine 
                key={`android-match-${activeRom.id}-${matchRestartKey}`}
                activeRom={activeRom}
                displaySettings={displaySettings}
                isPaused={isAndroidBottomSheetOpen || isAdvancedDrawerOpen || isArchitectureModalOpen}
                onOpenSettings={() => setIsAndroidBottomSheetOpen(true)}
              />

              {/* Virtual Touch Overlay (Auto hidden when physical controller attached) */}
              <VirtualTouchOverlay isVisible={isTouchControlsVisible} />

              {/* Native Android BottomSheet Layout for ROM/BIOS & Gamepad settings */}
              <AndroidIsolatedSettingsBottomSheet
                isOpen={isAndroidBottomSheetOpen}
                onClose={() => setIsAndroidBottomSheetOpen(false)}
                activeRom={activeRom}
                onSelectRom={(rom) => {
                  onSelectRom(rom);
                  setMatchRestartKey(prev => prev + 1);
                  addLog('I', 'CoreManager', `ROM switched to: "${rom.title}" (${rom.format.toUpperCase()})`);
                }}
                onResetControls={() => {
                  inputManager.resetMapping();
                  addLog('D', 'GamepadManager', 'Gamepad mapping reset to Sony DualShock standard layout');
                }}
                onLeaveRoom={() => {
                  netplayCoordinator.setOfflineMode('offline_single');
                  addLog('W', 'NetplayCoordinator', 'Left Netplay session. Reverted to Local Offline Mode');
                }}
                onOpenAdvancedSettings={() => {
                  setIsAndroidBottomSheetOpen(false);
                  setIsAdvancedDrawerOpen(true);
                }}
              />
            </div>

            {/* Android System Gesture Navigation Bar (Bottom) */}
            <div className="h-4 bg-black/90 flex items-center justify-center z-40 shrink-0">
              <div 
                className="w-32 h-1 bg-slate-500/60 rounded-full cursor-pointer hover:bg-slate-300 transition-colors"
                title="Android Gesture Pill (Swipe up for Home)"
              />
            </div>

          </div>
        )}

        {/* TAB 2: Android Studio Live Logcat Console */}
        {activeTab === 'logcat_console' && (
          <div className="w-full max-w-5xl h-[82vh] bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Android Logcat Live Stream
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Process: com.ps1.netplay (arm64-v8a)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    addLog('D', 'UserAction', 'Forced memory trim & garbage collection (GC_FOR_ALLOC)');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] cursor-pointer"
                >
                  🧹 Clear Logcat
                </button>
                <button
                  onClick={() => {
                    setActiveTab('emulator_screen');
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] cursor-pointer"
                >
                  ◀ العودة للشاشة
                </button>
              </div>
            </div>

            {/* Logs Window */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 select-text">
              {logs.map((log) => {
                const levelColor = 
                  log.level === 'E' ? 'text-red-400 font-bold bg-red-950/30' :
                  log.level === 'W' ? 'text-amber-400 font-bold bg-amber-950/20' :
                  log.level === 'I' ? 'text-sky-300' : 'text-emerald-400/90';
                
                return (
                  <div key={log.id} className={`p-1.5 rounded flex items-start gap-2.5 ${levelColor}`}>
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className="px-1.5 py-0.2 bg-slate-800/80 rounded text-[10px] shrink-0">
                      {log.level}/{log.tag}
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
              <div>🟢 60 FPS Target • Libretro Mednafen PSX Core Loaded • JNI Bridge Connected</div>
              <button 
                onClick={() => setIsArchitectureModalOpen(true)}
                className="text-emerald-400 hover:underline font-bold"
              >
                عرض كود C++ و Kotlin ⬅️
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Advanced Isolated Drawer for Netplay Multiplayer & Engine Tuning */}
      <IsolatedSettingsDrawer
        isOpen={isAdvancedDrawerOpen}
        onClose={() => setIsAdvancedDrawerOpen(false)}
        displaySettings={displaySettings}
        onUpdateDisplaySettings={onUpdateDisplaySettings}
        audioSettings={audioSettings}
        onUpdateAudioSettings={onUpdateAudioSettings}
        activeRom={activeRom}
        onSelectRom={(rom) => {
          onSelectRom(rom);
          setMatchRestartKey(prev => prev + 1);
        }}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onRestartMatch={() => setMatchRestartKey(prev => prev + 1)}
      />

      {/* Android Native Architecture & GitHub CI/CD Viewer Modal */}
      <AndroidNativeArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />

    </div>
  );
};
