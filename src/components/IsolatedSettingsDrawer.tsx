import React, { useState, useEffect } from 'react';
import { 
  PS1Button, 
  GamepadMapping, 
  DisplaySettings, 
  AudioSettings, 
  NetplaySessionState, 
  GameROM 
} from '../types';
import { inputManager, DEFAULT_GAMEPAD_MAPPING } from '../services/ps1InputManager';
import { netplayCoordinator } from '../services/netplayCoordinator';
import { soundFx } from '../services/audioSynthesizer';
import { ROMInspector, MemoryCardManager, SaveSlot } from '../services/romInspector';

interface IsolatedSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  displaySettings: DisplaySettings;
  onUpdateDisplaySettings: (settings: DisplaySettings) => void;
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: AudioSettings) => void;
  activeRom: GameROM;
  onSelectRom: (rom: GameROM) => void;
  onOpenArchitectureModal: () => void;
  onRestartMatch: () => void;
}

type TabType = 'gamepad' | 'netplay' | 'controls' | 'display' | 'audio' | 'memory' | 'players' | 'native_core';

export const IsolatedSettingsDrawer: React.FC<IsolatedSettingsDrawerProps> = ({
  isOpen,
  onClose,
  displaySettings,
  onUpdateDisplaySettings,
  audioSettings,
  onUpdateAudioSettings,
  activeRom,
  onSelectRom,
  onOpenArchitectureModal,
  onRestartMatch
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('netplay');
  const [netplayState, setNetplayState] = useState<NetplaySessionState>(netplayCoordinator['state']);
  const [roomInput, setRoomInput] = useState('');
  const [connectedGamepad, setConnectedGamepad] = useState<Gamepad | null>(null);
  const [gamepadMapping, setGamepadMapping] = useState<GamepadMapping>(inputManager.getMapping());
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>(MemoryCardManager.getSlots());
  const [mappingButtonTarget, setMappingButtonTarget] = useState<PS1Button | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isLoadingRom, setIsLoadingRom] = useState(false);

  // Subscribe to Netplay updates
  useEffect(() => {
    const unsub = netplayCoordinator.subscribe((s) => {
      setNetplayState(s);
    });
    return unsub;
  }, []);

  // Subscribe to Gamepad updates & Polling for visualizer
  useEffect(() => {
    const unsub = inputManager.onGamepadChange((pad) => {
      setConnectedGamepad(pad);
    });

    const interval = setInterval(() => {
      if (isOpen) {
        const pad = inputManager.getConnectedGamepad();
        setConnectedGamepad(pad);
      }
    }, 150);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isOpen]);

  // Handle Gamepad remapping capture
  useEffect(() => {
    if (mappingButtonTarget === null) return;

    const checkGamepadPress = () => {
      const pad = inputManager.getConnectedGamepad();
      if (pad) {
        for (let b = 0; b < pad.buttons.length; b++) {
          if (pad.buttons[b]?.pressed) {
            // Map button
            const newMap = { ...gamepadMapping };
            newMap.buttonMap[b] = mappingButtonTarget;
            inputManager.setMapping(newMap);
            setGamepadMapping(newMap);
            soundFx.playUiBlip(950);
            setMappingButtonTarget(null);
            return;
          }
        }
      }
    };

    const timer = setInterval(checkGamepadPress, 50);
    return () => clearInterval(timer);
  }, [mappingButtonTarget, gamepadMapping]);

  if (!isOpen) return null;

  // Netplay Actions
  const handleCreateRoom = async () => {
    soundFx.playUiBlip(800);
    try {
      await netplayCoordinator.createRoom();
    } catch {
      //
    }
  };

  const handleJoinRoom = async () => {
    if (!roomInput.trim()) return;
    soundFx.playUiBlip(800);
    try {
      await netplayCoordinator.joinRoom(roomInput);
    } catch {
      //
    }
  };

  const handleLeaveRoom = () => {
    soundFx.playUiBlip(500);
    netplayCoordinator.setOfflineMode('offline_single');
  };

  const handleCopyLink = () => {
    soundFx.playUiBlip(900);
    const url = `${window.location.origin}?room=${netplayState.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // ROM File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingRom(true);
    soundFx.playUiBlip(750);
    try {
      const rom = await ROMInspector.inspectFile(file);
      onSelectRom(rom);
      soundFx.playPs1Boot();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRom(false);
    }
  };

  const ps1ButtonNames: Record<PS1Button, string> = {
    [PS1Button.CROSS]: '✕ Cross (تأكيد / نيترو)',
    [PS1Button.CIRCLE]: '○ Circle (إلغاء / صاروخ)',
    [PS1Button.SQUARE]: '□ Square (رشاش)',
    [PS1Button.TRIANGLE]: '△ Triangle (لغم)',
    [PS1Button.L1]: 'L1 (دوران حاد يسار)',
    [PS1Button.R1]: 'R1 (دوران حاد يمين)',
    [PS1Button.L2]: 'L2 (فرملة خلفية)',
    [PS1Button.R2]: 'R2 (دفع إضافي)',
    [PS1Button.SELECT]: 'Select (اختيار)',
    [PS1Button.START]: 'Start (إيقاف مؤقت)',
    [PS1Button.L3]: 'L3 (ضغط عصا اليسار)',
    [PS1Button.R3]: 'R3 (ضغط عصا اليمين)',
    [PS1Button.DPAD_UP]: 'D-Pad أعلى (تسارع)',
    [PS1Button.DPAD_DOWN]: 'D-Pad أسفل (رجوع)',
    [PS1Button.DPAD_LEFT]: 'D-Pad يسار (انعطاف)',
    [PS1Button.DPAD_RIGHT]: 'D-Pad يمين (انعطاف)',
  };

  return (
    <div 
      id="ps1-isolated-settings-drawer" 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        id="settings-panel-container"
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Title & Close Button */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-bold text-white shadow-md text-sm">
              PS1
            </div>
            <div>
              <h2 className="font-cyber font-bold text-base sm:text-lg text-white">
                لوحة إعدادات المحاكي و Netplay
              </h2>
              <p className="text-xs text-slate-400 font-mono-retro">
                Combat 3 Multiplayer Platform • Isolated Engine Control
              </p>
            </div>
          </div>

          <button
            id="btn-close-settings"
            onClick={() => {
              soundFx.playUiBlip(600);
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation (Horizontal Bar) */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-950/30 px-3 py-1.5 gap-1.5 scrollbar-none text-xs font-cyber">
          <button
            id="tab-netplay"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('netplay'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'netplay' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🌐</span> الشبكة و Netplay
          </button>

          <button
            id="tab-gamepad"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('gamepad'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'gamepad' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🕹️</span> يد التحكم (Gamepad)
          </button>

          <button
            id="tab-controls"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('controls'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'controls' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🎮</span> تعيين الأزرار
          </button>

          <button
            id="tab-display"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('display'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'display' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🖥️</span> الشاشة والعرض
          </button>

          <button
            id="tab-audio"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('audio'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audio' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🔊</span> الصوت (SPU)
          </button>

          <button
            id="tab-memory"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('memory'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'memory' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>💾</span> بطاقة الذاكرة والحفظ
          </button>

          <button
            id="tab-players"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('players'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'players' ? 'bg-red-600/90 text-white font-bold shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>👥</span> اللاعبين
          </button>

          <button
            id="tab-native_core"
            onClick={() => { soundFx.playUiBlip(850); setActiveTab('native_core'); }}
            className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'native_core' ? 'bg-indigo-600/90 text-white font-bold shadow-md' : 'text-indigo-400 hover:text-indigo-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🏛️</span> معمارية C++ و Android NDK
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          
          {/* TAB 1: NETPLAY & MULTIPLAYER */}
          {activeTab === 'netplay' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/50">
                      غرفة اللعب الجماعي
                    </span>
                    <span className="text-xs text-slate-400 font-mono-retro">
                      الحالة: {netplayState.isConnected ? 'متصل ومزامن 🟢' : (netplayState.isConnecting ? 'جاري الاتصال... 🟡' : 'وضع محلي / غير متصل ⚪')}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-white mt-1">
                    {netplayState.roomCode ? `رمز الغرفة: ${netplayState.roomCode}` : 'إنشاء أو الانضمام إلى غرفة Netplay'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-lg mt-0.5">
                    يقوم نظام Netplay بمزامنة إدخالات اللاعبين (InputFrames) عبر اتصال P2P فائق السرعة مع تعويض التأخير وتوقع الإطارات (Rollback Prediction).
                  </p>
                </div>

                {netplayState.roomCode && (
                  <button
                    id="btn-copy-invite-link"
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>📋</span> {copySuccess ? 'تم النسخ بنجاح!' : 'نسخ رابط الدعوة'}
                  </button>
                )}
              </div>

              {/* Room Management Controls */}
              {!netplayState.isConnected && !netplayState.roomCode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Host Box */}
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-white text-base">👑 إنشاء غرفة جديدة (Host)</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        ستصبح المضيف للجلسة، وسيقوم النظام بتوليد رمز مكون من 6 أحرف لمشاركته مع اللاعب الثاني.
                      </p>
                    </div>
                    <button
                      id="btn-create-netplay-room"
                      onClick={handleCreateRoom}
                      disabled={netplayState.isConnecting}
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg shadow-lg cursor-pointer transition-transform active:scale-95 text-xs flex items-center justify-center gap-2"
                    >
                      {netplayState.isConnecting ? 'جاري إنشاء الغرفة...' : 'إنشاء غرفة 6 أحرف 🚀'}
                    </button>
                  </div>

                  {/* Join Box */}
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-white text-base">🎮 الانضمام إلى غرفة (Join)</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        أدخل رمز الغرفة المكون من 6 أحرف للدخول كـ (اللاعب 2).
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        id="input-room-code"
                        type="text"
                        placeholder="مثلاً: CB7K92"
                        maxLength={8}
                        value={roomInput}
                        onChange={e => setRoomInput(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono-retro font-bold text-sm uppercase tracking-widest text-white focus:outline-hidden focus:border-red-500"
                      />
                      <button
                        id="btn-join-room-action"
                        onClick={handleJoinRoom}
                        disabled={!roomInput.trim() || netplayState.isConnecting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-lg cursor-pointer transition-transform active:scale-95 text-xs"
                      >
                        دخول ⚡
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-emerald-400">
                      متصل مع: {netplayState.opponentName}
                    </span>
                    <button
                      id="btn-leave-room"
                      onClick={handleLeaveRoom}
                      className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 rounded-md text-red-300 text-xs font-bold cursor-pointer"
                    >
                      🚪 مغادرة الغرفة والعودة للعب الفردي
                    </button>
                  </div>

                  {/* Netplay Live Diagnostics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-retro text-center">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">زمن الاستجابة (Ping)</span>
                      <span className="text-base font-bold text-amber-400">{netplayState.ping} ms</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">تأخير الإطارات (Delay)</span>
                      <span className="text-base font-bold text-sky-400">{netplayState.frameDelay} Frames</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">نافذة التوقع (Rollback)</span>
                      <span className="text-base font-bold text-purple-400">{netplayState.rollbackFrames} Frames</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">فقدان الحزم (Loss)</span>
                      <span className="text-base font-bold text-emerald-400">{netplayState.packetLoss}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Game ROM / ISO Fingerprint Verification */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-sm">💿 نسخة اللعبة المشغلة (Game Fingerprint)</h4>
                    <p className="text-xs text-slate-400">
                      يجب أن يملك الطرفان نفس ملف الـ ROM لضمان التطابق الحتمي أثناء مزامنة الإطارات.
                    </p>
                  </div>
                  <label className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 cursor-pointer transition-colors">
                    {isLoadingRom ? 'جاري التحقق...' : 'استيراد ملف ISO/BIN 📂'}
                    <input 
                      type="file" 
                      accept=".iso,.bin,.cue,.chd,.img" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs font-mono-retro">
                  <div>
                    <span className="text-red-400 font-bold block">{activeRom.title}</span>
                    <span className="text-slate-400">Serial: {activeRom.serial} • الحجم: {(activeRom.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                  <div className="px-2.5 py-1 bg-black/60 rounded border border-slate-700 text-[11px] text-slate-300">
                    Checksum: <span className="text-amber-300 font-bold">{activeRom.checksum}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GAMEPAD (Bluetooth & USB OTG) */}
          {activeTab === 'gamepad' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <span>🕹️</span> التعرف على يد التحكم (Bluetooth / USB OTG)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    التعرف التلقائي على أيدي تحكم PS4/PS5 DualShock، Xbox Wireless، 8BitDo، وأيدي التحكم عبر وصلة OTG.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${connectedGamepad ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span className="text-xs font-mono-retro font-bold text-slate-300">
                    {connectedGamepad ? 'Gamepad متصل ومفعل' : 'لم يتم اكتشاف Gamepad'}
                  </span>
                </div>
              </div>

              {connectedGamepad ? (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center text-xs font-mono-retro">
                    <span className="text-white font-bold">{connectedGamepad.id}</span>
                    <span className="text-slate-400">الأزرار: {connectedGamepad.buttons.length} • المحاور: {connectedGamepad.axes.length}</span>
                  </div>

                  {/* Visual Controller Buttons Grid */}
                  <div>
                    <span className="text-xs text-slate-400 block mb-2 font-cyber">مراقبة الأزرار المباشرة (Live Input Monitor):</span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 font-mono-retro text-xs text-center">
                      {Array.from({ length: Math.min(16, connectedGamepad.buttons.length) }).map((_, idx) => {
                        const isPressed = connectedGamepad.buttons[idx]?.pressed;
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded border transition-all ${
                              isPressed 
                                ? 'bg-red-600 text-white font-bold border-red-400 scale-105 shadow-md' 
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            B{idx}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Analog Sticks & Deadzone Calibration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white font-bold">عصا اليسار (Left Stick Deadzone)</span>
                        <span className="text-amber-400 font-mono-retro">
                          {Math.round(gamepadMapping.leftStick.deadzone * 100)}%
                        </span>
                      </div>
                      <input
                        id="slider-left-deadzone"
                        type="range"
                        min="5"
                        max="40"
                        value={Math.round(gamepadMapping.leftStick.deadzone * 100)}
                        onChange={e => {
                          const val = Number(e.target.value) / 100;
                          const newMap = { ...gamepadMapping, leftStick: { ...gamepadMapping.leftStick, deadzone: val } };
                          setGamepadMapping(newMap);
                          inputManager.setMapping(newMap);
                        }}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono-retro">
                        <span>X: {connectedGamepad.axes[gamepadMapping.leftStick.xAxis]?.toFixed(2) || '0.00'}</span>
                        <span>Y: {connectedGamepad.axes[gamepadMapping.leftStick.yAxis]?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white font-bold">عصا اليمين (Right Stick Deadzone)</span>
                        <span className="text-amber-400 font-mono-retro">
                          {Math.round(gamepadMapping.rightStick.deadzone * 100)}%
                        </span>
                      </div>
                      <input
                        id="slider-right-deadzone"
                        type="range"
                        min="5"
                        max="40"
                        value={Math.round(gamepadMapping.rightStick.deadzone * 100)}
                        onChange={e => {
                          const val = Number(e.target.value) / 100;
                          const newMap = { ...gamepadMapping, rightStick: { ...gamepadMapping.rightStick, deadzone: val } };
                          setGamepadMapping(newMap);
                          inputManager.setMapping(newMap);
                        }}
                        className="w-full accent-red-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono-retro">
                        <span>X: {connectedGamepad.axes[gamepadMapping.rightStick.xAxis]?.toFixed(2) || '0.00'}</span>
                        <span>Y: {connectedGamepad.axes[gamepadMapping.rightStick.yAxis]?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center space-y-3">
                  <div className="text-3xl">🔌</div>
                  <h4 className="font-bold text-white">قم بتوصيل يد التحكم الخاصة بك</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    قم بإقران يد التحكم عبر البلوتوث بهاتفك أو حاسوبك، أو قم بتوصيلها عبر كابل OTG، ثم اضغط على أي زر في اليد ليتم التعرف عليها فوراً.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BUTTON MAPPING */}
          {activeTab === 'controls' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">🎮 إعادة تعيين أزرار يد التحكم (Button Remapping)</h3>
                  <p className="text-xs text-slate-400">
                    اضغط على أي زر PS1 ثم اضغط على الزر المقابل له في يد التحكم لتخصيص الخريطة.
                  </p>
                </div>
                <button
                  id="btn-reset-default-mapping"
                  onClick={() => {
                    soundFx.playUiBlip(700);
                    inputManager.setMapping({ ...DEFAULT_GAMEPAD_MAPPING });
                    setGamepadMapping({ ...DEFAULT_GAMEPAD_MAPPING });
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  استعادة الافتراضي ↺
                </button>
              </div>

              {mappingButtonTarget !== null && (
                <div className="p-3 bg-amber-950/60 border border-amber-500 rounded-lg text-center text-xs font-bold text-amber-200 animate-pulse">
                  👉 اضغط الآن على الزر المطلوب في اليد لتعيينه كـ: ({ps1ButtonNames[mappingButtonTarget]})
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(ps1ButtonNames).map(([btnKey, btnLabel]) => {
                  const ps1BtnNum = Number(btnKey) as PS1Button;
                  // Find which gamepad index maps to this
                  const mappedEntry = Object.entries(gamepadMapping.buttonMap).find(
                    ([, mappedPs1]) => mappedPs1 === ps1BtnNum
                  );
                  const currentPadIndex = mappedEntry ? `زر Gamepad ${mappedEntry[0]}` : 'غير معين';

                  return (
                    <div 
                      key={btnKey}
                      className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 flex justify-between items-center"
                    >
                      <span className="font-medium text-xs text-white">{btnLabel}</span>
                      <button
                        id={`btn-map-${btnKey}`}
                        onClick={() => {
                          soundFx.playUiBlip(800);
                          setMappingButtonTarget(ps1BtnNum);
                        }}
                        className={`px-3 py-1 rounded text-xs font-mono-retro font-bold border transition-colors cursor-pointer ${
                          mappingButtonTarget === ps1BtnNum 
                            ? 'bg-amber-600 text-white border-amber-400 animate-pulse' 
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {currentPadIndex}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DISPLAY SETTINGS */}
          {activeTab === 'display' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-bold text-white text-base">🖥️ إعدادات الشاشة والعرض والتكيف</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Aspect Ratio */}
                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-white block">نسبة أبعاد الشاشة (Aspect Ratio):</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-retro">
                    {(['4:3', '16:9', 'stretch', 'fit'] as const).map(ratio => (
                      <button
                        key={ratio}
                        id={`btn-ratio-${ratio}`}
                        onClick={() => {
                          soundFx.playUiBlip(800);
                          onUpdateDisplaySettings({ ...displaySettings, aspectRatio: ratio });
                        }}
                        className={`py-2 rounded-lg border font-bold cursor-pointer transition-colors ${
                          displaySettings.aspectRatio === ratio
                            ? 'bg-red-600 text-white border-red-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {ratio === '4:3' ? '4:3 (PS1 الأصلي)' : (ratio === '16:9' ? '16:9 عريض' : (ratio === 'stretch' ? 'ملء الشاشة' : 'تكيف تلقائي'))}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CRT Scanline Filter */}
                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-xs block">فلتر شاشات التلفاز الكلاسيكية (CRT Scanlines)</span>
                    <span className="text-[11px] text-slate-400">تأثير خطوط المسح والظلال التناظرية لعام 1996</span>
                  </div>
                  <input
                    id="toggle-crt-filter"
                    type="checkbox"
                    checked={displaySettings.crtFilter}
                    onChange={e => onUpdateDisplaySettings({ ...displaySettings, crtFilter: e.target.checked })}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                </div>

                {/* Show FPS Meter */}
                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-xs block">عداد الإطارات (FPS Counter)</span>
                    <span className="text-[11px] text-slate-400">عرض معدل التحديث 60fps أثناء اللعب</span>
                  </div>
                  <input
                    id="toggle-show-fps"
                    type="checkbox"
                    checked={displaySettings.showFps}
                    onChange={e => onUpdateDisplaySettings({ ...displaySettings, showFps: e.target.checked })}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                </div>

                {/* Touch Virtual Controls */}
                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-xs block">أزرار اللمس الافتراضية (Touch Controls)</span>
                    <span className="text-[11px] text-slate-400">إظهار أزرار الشاشة عند عدم استخدام Gamepad</span>
                  </div>
                  <input
                    id="toggle-touch-controls"
                    type="checkbox"
                    checked={displaySettings.showTouchControls}
                    onChange={e => onUpdateDisplaySettings({ ...displaySettings, showTouchControls: e.target.checked })}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIO SETTINGS */}
          {activeTab === 'audio' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-bold text-white text-base">🔊 إعدادات وحدة الصوت (PS1 SPU Sound System)</h3>
              
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white">مستوى الصوت العام (Master Volume)</span>
                    <span className="text-amber-400 font-mono-retro">{Math.round(audioSettings.masterVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-master-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(audioSettings.masterVolume * 100)}
                    onChange={e => {
                      const val = Number(e.target.value) / 100;
                      const next = { ...audioSettings, masterVolume: val };
                      onUpdateAudioSettings(next);
                      soundFx.setVolumes(next.masterVolume, next.sfxVolume, next.musicVolume, next.isMuted);
                    }}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white">المؤثرات الصوتية والأسلحة (SFX Volume)</span>
                    <span className="text-amber-400 font-mono-retro">{Math.round(audioSettings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-sfx-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(audioSettings.sfxVolume * 100)}
                    onChange={e => {
                      const val = Number(e.target.value) / 100;
                      const next = { ...audioSettings, sfxVolume: val };
                      onUpdateAudioSettings(next);
                      soundFx.setVolumes(next.masterVolume, next.sfxVolume, next.musicVolume, next.isMuted);
                    }}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-white">الموسيقى القتالية (Combat Synthwave Music)</span>
                    <span className="text-amber-400 font-mono-retro">{Math.round(audioSettings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-music-volume"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(audioSettings.musicVolume * 100)}
                    onChange={e => {
                      const val = Number(e.target.value) / 100;
                      const next = { ...audioSettings, musicVolume: val };
                      onUpdateAudioSettings(next);
                      soundFx.setVolumes(next.masterVolume, next.sfxVolume, next.musicVolume, next.isMuted);
                    }}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 bg-slate-950/50 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-xs block">كتم الصوت بالكامل (Mute All)</span>
                    <span className="text-[11px] text-slate-400">إيقاف كافة المخرجات الصوتية مؤقتاً</span>
                  </div>
                  <input
                    id="toggle-mute-sound"
                    type="checkbox"
                    checked={audioSettings.isMuted}
                    onChange={e => {
                      const next = { ...audioSettings, isMuted: e.target.checked };
                      onUpdateAudioSettings(next);
                      soundFx.setVolumes(next.masterVolume, next.sfxVolume, next.musicVolume, next.isMuted);
                    }}
                    className="w-5 h-5 accent-red-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: MEMORY CARD & SAVE STATES */}
          {activeTab === 'memory' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">💾 بطاقة الذاكرة وحفظ الحالات (PS1 Memory Card)</h3>
                  <p className="text-xs text-slate-400">15 Blocks Memory Card Architecture متوافقة مع محاكيات PS1</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {saveSlots.map(slot => (
                  <div 
                    key={slot.slot}
                    className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex justify-between items-center gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-retro font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          فتحة {slot.slot}
                        </span>
                        <span className="font-bold text-xs text-white">{slot.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono-retro block mt-1">
                        الوقت: {slot.timestamp} • وقت اللعب: {slot.gameTime}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        id={`btn-load-save-${slot.slot}`}
                        onClick={() => {
                          soundFx.playUiBlip(900);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-xs font-bold text-white cursor-pointer"
                      >
                        تحميل
                      </button>
                      <button
                        id={`btn-write-save-${slot.slot}`}
                        onClick={() => {
                          soundFx.playUiBlip(950);
                          const updated: SaveSlot = {
                            slot: slot.slot,
                            title: `حفظ الجلسة الحالية - ${new Date().toLocaleTimeString('ar-EG')}`,
                            timestamp: 'الآن',
                            gameTime: '00:15:30',
                            previewUrl: '',
                            matchScore: '1 - 0'
                          };
                          MemoryCardManager.saveSlot(slot.slot, updated);
                          setSaveSlots(MemoryCardManager.getSlots());
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: PLAYERS */}
          {activeTab === 'players' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-bold text-white text-base">👥 حالة اللاعبين وجلسة اللعب</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Player 1 Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border-l-4 border-l-red-500 border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-400 font-cyber">اللاعب 1 (المضيف / P1)</span>
                    <span className="px-2 py-0.5 bg-red-950/80 text-red-300 rounded text-xs font-mono-retro">
                      Crimson Crusher
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    التحكم: {connectedGamepad ? `يد تحكم متصلة (${connectedGamepad.id.slice(0, 16)}...)` : 'لوحة المفاتيح / اللمس'}
                  </p>
                  <div className="text-[11px] font-mono-retro text-slate-300">
                    الحالة: <span className="text-emerald-400 font-bold">جاهز للقتال 🟢</span>
                  </div>
                </div>

                {/* Player 2 Card */}
                <div className="p-4 rounded-xl bg-slate-950/60 border-r-4 border-r-blue-500 border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-400 font-cyber">اللاعب 2 (P2)</span>
                    <span className="px-2 py-0.5 bg-blue-950/80 text-blue-300 rounded text-xs font-mono-retro">
                      Cobalt Spectre
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {netplayState.isConnected ? `الطرف المتصل: ${netplayState.opponentName}` : 'ذكاء اصطناعي (AI Bot) / لاعب محلي ثانٍ'}
                  </p>
                  <div className="text-[11px] font-mono-retro text-slate-300">
                    Ping: <span className="text-amber-400 font-bold">{netplayState.isConnected ? `${netplayState.ping} ms` : 'Local 0 ms'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  id="btn-restart-current-match"
                  onClick={() => {
                    onRestartMatch();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                >
                  <span>⚔️</span> إعادة تشغيل الجولة الحالية
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: NATIVE C++ & ANDROID NDK ARCHITECTURE */}
          {activeTab === 'native_core' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-indigo-400 text-base flex items-center gap-2">
                    <span>🏛️</span> بنية محاكي PS1 الأصلي لـ Android (NDK + CMake + Libretro JNI)
                  </h3>
                  <p className="text-xs text-slate-400">
                    تصميم معماري متكامل لربط النواة الأصلية (Beetle PSX / DuckStation Core) عبر JNI في أندرويد.
                  </p>
                </div>
                <button
                  id="btn-view-full-native-code"
                  onClick={() => {
                    soundFx.playUiBlip(900);
                    onOpenArchitectureModal();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  استعراض وتصدير كود Android NDK 📋
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-indigo-900/50 space-y-3 font-mono-retro text-xs text-slate-300">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <span>⚙️</span> مسار المعالجة في C++ / Kotlin:
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  1. <strong className="text-white">NativeCoreBridge.kt</strong> يربط دوال Kotlin مع مكتبة C++ المشتركة عبر JNI.<br/>
                  2. <strong className="text-white">libretro_bridge.cpp</strong> يدير تحميل ملفات <code className="text-indigo-400">mednafen_psx_libretro_android.so</code> ديناميكياً مع استدعاءات:
                  <code className="text-amber-300 block bg-slate-900 p-2 rounded my-1">
                    retro_init() • retro_load_game() • retro_run() • retro_unload_game()
                  </code>
                  3. <strong className="text-white">Video Callback:</strong> يمرر Framebuffer مباشرة إلى OpenGL ES 3.0 Texture أو SurfaceView.<br/>
                  4. <strong className="text-white">Input Callback:</strong> يمرر حالة أزرار Gamepad الـ 16 بت إلى منفذ Controller 1 و Controller 2 بالمحاكي في كل Frame.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex justify-between items-center text-[11px] text-slate-400 font-mono-retro">
          <span>PS1 Netplay Engine v3.4 • Ready</span>
          <button
            id="btn-confirm-and-return"
            onClick={() => {
              soundFx.playUiBlip(700);
              onClose();
            }}
            className="px-5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            العودة إلى شاشة اللعبة النظيفة ✓
          </button>
        </div>
      </div>
    </div>
  );
};
