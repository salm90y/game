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
import { netplayCoordinator } from './services/netplayCoordinator';
import { AndroidDeviceSimulator } from './components/AndroidDeviceSimulator';

export default function App() {
  const [activeRom, setActiveRom] = useState<GameROM>(BUILTIN_COMBAT_3_ROM);

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

  return (
    <main 
      id="ps1-platform-root"
      className="relative w-screen h-screen bg-[#090D16] overflow-hidden select-none font-sans"
    >
      <AndroidDeviceSimulator
        activeRom={activeRom}
        onSelectRom={setActiveRom}
        displaySettings={displaySettings}
        onUpdateDisplaySettings={setDisplaySettings}
        audioSettings={audioSettings}
        onUpdateAudioSettings={setAudioSettings}
      />
    </main>
  );
}

