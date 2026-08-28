/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  DisplaySettings, 
  AudioSettings, 
  GameROM 
} from './types';
import { BUILTIN_COMBAT_3_ROM } from './services/romInspector';
import { inputManager } from './services/ps1InputManager';
import { netplayCoordinator } from './services/netplayCoordinator';
import { PS1CombatEngine } from './components/PS1CombatEngine';
import { IsolatedSettingsDrawer } from './components/IsolatedSettingsDrawer';
import { VirtualTouchOverlay } from './components/VirtualTouchOverlay';
import { AndroidNativeArchitectureModal } from './components/AndroidNativeArchitectureModal';

export default function App() {
  const [activeRom, setActiveRom] = useState<GameROM>(BUILTIN_COMBAT_3_ROM);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [hasPhysicalGamepad, setHasPhysicalGamepad] = useState(false);
  const [isMatchRestartTrigger, setIsMatchRestartTrigger] = useState(0);

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    aspectRatio: '4:3',
    crtFilter: true,
    scanlines: true,
    resolutionScale: 1,
    showFps: true,
    colorDithering: true,
    affineWarp: true,
    showTouchControls: true,
    autoHideControlsOnGamepad: true,
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    masterVolume: 0.8,
    sfxVolume: 0.75,
    musicVolume: 0.5,
    audioLatency: 'low',
    isMuted: false,
  });

  // Check URL query parameters for invite link: ?room=XXXXXX
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      netplayCoordinator.joinRoom(roomCode).catch(err => {
        console.warn('Auto-join failed:', err);
      });
    }
  }, []);

  // Monitor physical gamepad connection to auto-hide virtual touch buttons
  useEffect(() => {
    const unsub = inputManager.onGamepadChange((pad) => {
      setHasPhysicalGamepad(pad !== null && pad.connected);
    });
    return unsub;
  }, []);

  // Determine if Touch Overlay should be rendered
  const isTouchControlsVisible = 
    displaySettings.showTouchControls && 
    !(displaySettings.autoHideControlsOnGamepad && hasPhysicalGamepad);

  return (
    <main 
      id="ps1-platform-root"
      className="relative w-screen h-screen bg-black overflow-hidden select-none touch-none flex flex-col justify-center items-center font-sans"
    >
      {/* 1. Main 3D PS1 Game Engine Viewport (Clean, Fullscreen, No On-screen intrusive buttons) */}
      <PS1CombatEngine 
        key={`match-${activeRom.id}-${isMatchRestartTrigger}`}
        activeRom={activeRom}
        displaySettings={displaySettings}
        isPaused={isSettingsOpen || isArchitectureModalOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Virtual Touch Gamepad Overlay (Auto-hidden when physical gamepad is plugged in or user toggles off) */}
      <VirtualTouchOverlay isVisible={isTouchControlsVisible} />

      {/* 3. Isolated Settings Drawer (Triggered cleanly by discrete corner ⚙ button) */}
      <IsolatedSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        displaySettings={displaySettings}
        onUpdateDisplaySettings={setDisplaySettings}
        audioSettings={audioSettings}
        onUpdateAudioSettings={setAudioSettings}
        activeRom={activeRom}
        onSelectRom={(rom) => {
          setActiveRom(rom);
          setIsMatchRestartTrigger(prev => prev + 1);
        }}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onRestartMatch={() => setIsMatchRestartTrigger(prev => prev + 1)}
      />

      {/* 4. Android Native Architecture & C++ Libretro Code Viewer Modal */}
      <AndroidNativeArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
      />
    </main>
  );
}
