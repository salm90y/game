export enum PS1Button {
  CROSS = 0,     // X (A on Xbox, B on Nintendo)
  CIRCLE = 1,    // O (B on Xbox, A on Nintendo)
  SQUARE = 2,    // □ (X on Xbox, Y on Nintendo)
  TRIANGLE = 3,  // △ (Y on Xbox, X on Nintendo)
  L1 = 4,
  R1 = 5,
  L2 = 6,
  R2 = 7,
  SELECT = 8,
  START = 9,
  L3 = 10,
  R3 = 11,
  DPAD_UP = 12,
  DPAD_DOWN = 13,
  DPAD_LEFT = 14,
  DPAD_RIGHT = 15,
}

export interface GamepadMapping {
  id: string;
  name: string;
  buttonMap: Record<number, PS1Button>; // Gamepad button index -> PS1Button
  dpadAxes: {
    horizontalAxis: number;
    verticalAxis: number;
    invertedX: boolean;
    invertedY: boolean;
  };
  leftStick: {
    xAxis: number;
    yAxis: number;
    deadzone: number;
  };
  rightStick: {
    xAxis: number;
    yAxis: number;
    deadzone: number;
  };
}

export interface InputFrame {
  frame: number;
  p1Input: number; // 16-bit bitmask
  p2Input: number; // 16-bit bitmask
  p1Analog?: { lx: number; ly: number; rx: number; ry: number };
  p2Analog?: { lx: number; ly: number; rx: number; ry: number };
  timestamp: number;
  checksum?: string;
}

export type NetplayRole = 'host' | 'client' | 'offline_vs' | 'offline_single';

export interface NetplaySessionState {
  role: NetplayRole;
  roomCode: string;
  isConnected: boolean;
  isConnecting: boolean;
  peerId: string | null;
  opponentPeerId: string | null;
  opponentName: string;
  ping: number; // in ms
  jitter: number;
  frameDelay: number; // buffer frames (e.g. 2 frames = ~33ms)
  rollbackFrames: number;
  packetLoss: number; // %
  syncProgress: number; // 0-100%
  errorMessage: string | null;
}

export interface DisplaySettings {
  aspectRatio: '4:3' | '16:9' | 'stretch' | 'fit';
  crtFilter: boolean;
  scanlines: boolean;
  resolutionScale: 1 | 2 | 4;
  showFps: boolean;
  colorDithering: boolean;
  affineWarp: boolean;
  showTouchControls: boolean;
  autoHideControlsOnGamepad: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  audioLatency: 'low' | 'balanced' | 'safe';
  isMuted: boolean;
}

export interface GameROM {
  id: string;
  title: string;
  serial: string;
  fileName: string;
  fileSize: number;
  checksum: string;
  format: 'ISO' | 'BIN/CUE' | 'CHD' | 'BUILTIN';
  isVerified: boolean;
  coverImage?: string;
}

export interface VehicleState {
  x: number;
  z: number;
  y: number;
  rotation: number;
  speed: number;
  health: number;
  maxHealth: number;
  shields: number;
  nitro: number;
  missiles: number;
  mines: number;
  score: number;
  isDrifting: boolean;
  isFiring: boolean;
  lastHitTime: number;
  alive: boolean;
}

export interface GameMatchState {
  frame: number;
  gameTime: number;
  p1: VehicleState;
  p2: VehicleState;
  projectiles: Array<{
    id: string;
    type: 'bullet' | 'missile' | 'mine';
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    owner: 1 | 2;
    lifetime: number;
  }>;
  pickups: Array<{
    id: string;
    type: 'health' | 'missiles' | 'nitro' | 'shield';
    x: number;
    z: number;
    active: boolean;
    respawnTimer: number;
  }>;
  round: number;
  winner: 0 | 1 | 2; // 0 = playing, 1 = P1, 2 = P2
  isPaused: boolean;
}
