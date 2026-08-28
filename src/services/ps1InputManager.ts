import { PS1Button, GamepadMapping } from '../types';

export const DEFAULT_GAMEPAD_MAPPING: GamepadMapping = {
  id: 'standard-ps1-default',
  name: 'PS1 Standard Layout',
  buttonMap: {
    0: PS1Button.CROSS,     // Bottom button (A/Cross) -> PS1 Cross
    1: PS1Button.CIRCLE,    // Right button (B/Circle) -> PS1 Circle
    2: PS1Button.SQUARE,    // Left button (X/Square) -> PS1 Square
    3: PS1Button.TRIANGLE,  // Top button (Y/Triangle) -> PS1 Triangle
    4: PS1Button.L1,        // Left shoulder -> L1
    5: PS1Button.R1,        // Right shoulder -> R1
    6: PS1Button.L2,        // Left trigger -> L2
    7: PS1Button.R2,        // Right trigger -> R2
    8: PS1Button.SELECT,    // Back/Select -> Select
    9: PS1Button.START,     // Start -> Start
    10: PS1Button.L3,       // Left stick press -> L3
    11: PS1Button.R3,       // Right stick press -> R3
    12: PS1Button.DPAD_UP,   // Dpad up
    13: PS1Button.DPAD_DOWN, // Dpad down
    14: PS1Button.DPAD_LEFT, // Dpad left
    15: PS1Button.DPAD_RIGHT,// Dpad right
  },
  dpadAxes: {
    horizontalAxis: 0,
    verticalAxis: 1,
    invertedX: false,
    invertedY: false,
  },
  leftStick: {
    xAxis: 0,
    yAxis: 1,
    deadzone: 0.18,
  },
  rightStick: {
    xAxis: 2,
    yAxis: 3,
    deadzone: 0.18,
  },
};

export class PS1InputManager {
  private activeMapping: GamepadMapping = { ...DEFAULT_GAMEPAD_MAPPING };
  private keyboardState: Set<string> = new Set();
  private touchState: Map<PS1Button, boolean> = new Map();
  private touchAnalog: { lx: number; ly: number; rx: number; ry: number } = { lx: 0, ly: 0, rx: 0, ry: 0 };
  private connectedGamepadIndex: number | null = null;
  private gamepadListeners: Array<(gamepad: Gamepad | null) => void> = [];

  constructor() {
    this.initKeyboardListeners();
    this.initGamepadListeners();
    this.loadSavedMapping();
  }

  private initKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      this.keyboardState.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keyboardState.delete(e.code);
    });
  }

  private initGamepadListeners() {
    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
      this.connectedGamepadIndex = e.gamepad.index;
      this.notifyGamepadChanged(e.gamepad);
    });

    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      if (this.connectedGamepadIndex === e.gamepad.index) {
        this.connectedGamepadIndex = null;
      }
      this.notifyGamepadChanged(null);
    });
  }

  public onGamepadChange(callback: (gamepad: Gamepad | null) => void) {
    this.gamepadListeners.push(callback);
    // Initial trigger
    const current = this.getConnectedGamepad();
    callback(current);
    return () => {
      this.gamepadListeners = this.gamepadListeners.filter(cb => cb !== callback);
    };
  }

  private notifyGamepadChanged(gamepad: Gamepad | null) {
    this.gamepadListeners.forEach(cb => cb(gamepad));
  }

  public getConnectedGamepad(): Gamepad | null {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.connectedGamepadIndex !== null && gamepads[this.connectedGamepadIndex]) {
      return gamepads[this.connectedGamepadIndex];
    }
    // Find first available
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.connectedGamepadIndex = i;
        return gamepads[i];
      }
    }
    return null;
  }

  public setTouchButton(button: PS1Button, isPressed: boolean) {
    this.touchState.set(button, isPressed);
  }

  public setTouchAnalog(lx: number, ly: number, rx: number = 0, ry: number = 0) {
    this.touchAnalog = { lx, ly, rx, ry };
  }

  public setMapping(mapping: GamepadMapping) {
    this.activeMapping = mapping;
    try {
      localStorage.setItem('ps1_gamepad_mapping', JSON.stringify(mapping));
    } catch {
      // ignore
    }
  }

  public resetMapping() {
    this.setMapping({ ...DEFAULT_GAMEPAD_MAPPING });
  }

  public getMapping(): GamepadMapping {
    return this.activeMapping;
  }

  private loadSavedMapping() {
    try {
      const saved = localStorage.getItem('ps1_gamepad_mapping');
      if (saved) {
        this.activeMapping = JSON.parse(saved);
      }
    } catch {
      this.activeMapping = { ...DEFAULT_GAMEPAD_MAPPING };
    }
  }

  // Polls inputs and produces a 16-bit integer bitmask + analog coordinates
  public pollInput(playerNumber: 1 | 2 = 1): { bitmask: number; analog: { lx: number; ly: number; rx: number; ry: number } } {
    let bitmask = 0;
    let lx = 0;
    let ly = 0;
    let rx = 0;
    let ry = 0;

    // 1. Touch overlay input (for Player 1)
    if (playerNumber === 1) {
      this.touchState.forEach((isPressed, btn) => {
        if (isPressed) {
          bitmask |= (1 << btn);
        }
      });
      lx = this.touchAnalog.lx;
      ly = this.touchAnalog.ly;
      rx = this.touchAnalog.rx;
      ry = this.touchAnalog.ry;
    }

    // 2. Keyboard bindings
    if (playerNumber === 1) {
      // P1 Keyboard Controls (WASD + J/K/U/I + Space/Enter)
      if (this.keyboardState.has('KeyK') || this.keyboardState.has('KeyZ') || this.keyboardState.has('Space')) bitmask |= (1 << PS1Button.CROSS);
      if (this.keyboardState.has('KeyL') || this.keyboardState.has('KeyX')) bitmask |= (1 << PS1Button.CIRCLE);
      if (this.keyboardState.has('KeyJ') || this.keyboardState.has('KeyA')) bitmask |= (1 << PS1Button.SQUARE);
      if (this.keyboardState.has('KeyI') || this.keyboardState.has('KeyS')) bitmask |= (1 << PS1Button.TRIANGLE);

      if (this.keyboardState.has('KeyQ') || this.keyboardState.has('Digit1')) bitmask |= (1 << PS1Button.L1);
      if (this.keyboardState.has('KeyE') || this.keyboardState.has('Digit2')) bitmask |= (1 << PS1Button.R1);
      if (this.keyboardState.has('KeyU')) bitmask |= (1 << PS1Button.L2);
      if (this.keyboardState.has('KeyO')) bitmask |= (1 << PS1Button.R2);

      if (this.keyboardState.has('ShiftLeft') || this.keyboardState.has('Backspace')) bitmask |= (1 << PS1Button.SELECT);
      if (this.keyboardState.has('Enter') || this.keyboardState.has('Escape')) bitmask |= (1 << PS1Button.START);

      // D-Pad / Movement
      if (this.keyboardState.has('ArrowUp') || this.keyboardState.has('KeyW')) {
        bitmask |= (1 << PS1Button.DPAD_UP);
        ly = -1;
      }
      if (this.keyboardState.has('ArrowDown') || this.keyboardState.has('KeyS')) {
        bitmask |= (1 << PS1Button.DPAD_DOWN);
        ly = 1;
      }
      if (this.keyboardState.has('ArrowLeft') || this.keyboardState.has('KeyA')) {
        bitmask |= (1 << PS1Button.DPAD_LEFT);
        lx = -1;
      }
      if (this.keyboardState.has('ArrowRight') || this.keyboardState.has('KeyD')) {
        bitmask |= (1 << PS1Button.DPAD_RIGHT);
        lx = 1;
      }
    } else if (playerNumber === 2) {
      // P2 Keyboard Controls (Numpad / TFGH)
      if (this.keyboardState.has('Numpad1') || this.keyboardState.has('KeyN')) bitmask |= (1 << PS1Button.CROSS);
      if (this.keyboardState.has('Numpad2') || this.keyboardState.has('KeyM')) bitmask |= (1 << PS1Button.CIRCLE);
      if (this.keyboardState.has('Numpad4') || this.keyboardState.has('KeyB')) bitmask |= (1 << PS1Button.SQUARE);
      if (this.keyboardState.has('Numpad5') || this.keyboardState.has('KeyH')) bitmask |= (1 << PS1Button.TRIANGLE);

      if (this.keyboardState.has('Numpad7')) bitmask |= (1 << PS1Button.L1);
      if (this.keyboardState.has('Numpad9')) bitmask |= (1 << PS1Button.R1);
      if (this.keyboardState.has('KeyR')) bitmask |= (1 << PS1Button.DPAD_UP);
      if (this.keyboardState.has('KeyF')) bitmask |= (1 << PS1Button.DPAD_DOWN);
      if (this.keyboardState.has('KeyD')) bitmask |= (1 << PS1Button.DPAD_LEFT);
      if (this.keyboardState.has('KeyG')) bitmask |= (1 << PS1Button.DPAD_RIGHT);
    }

    // 3. Physical Gamepad Polling
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = playerNumber === 1 
      ? this.getConnectedGamepad() 
      : (gamepads.length > 1 ? gamepads[1] : null);

    if (pad && pad.connected) {
      // Buttons
      for (let b = 0; b < pad.buttons.length; b++) {
        const btnObj = pad.buttons[b];
        if (btnObj && (btnObj.pressed || btnObj.value > 0.4)) {
          const mappedPs1Btn = this.activeMapping.buttonMap[b];
          if (mappedPs1Btn !== undefined) {
            bitmask |= (1 << mappedPs1Btn);
          }
        }
      }

      // Left Stick with deadzone
      const rawLx = pad.axes[this.activeMapping.leftStick.xAxis] || 0;
      const rawLy = pad.axes[this.activeMapping.leftStick.yAxis] || 0;
      const deadzone = this.activeMapping.leftStick.deadzone;

      if (Math.abs(rawLx) > deadzone) {
        lx = (rawLx - Math.sign(rawLx) * deadzone) / (1 - deadzone);
        if (lx < -0.4) bitmask |= (1 << PS1Button.DPAD_LEFT);
        if (lx > 0.4) bitmask |= (1 << PS1Button.DPAD_RIGHT);
      }
      if (Math.abs(rawLy) > deadzone) {
        ly = (rawLy - Math.sign(rawLy) * deadzone) / (1 - deadzone);
        if (ly < -0.4) bitmask |= (1 << PS1Button.DPAD_UP);
        if (ly > 0.4) bitmask |= (1 << PS1Button.DPAD_DOWN);
      }

      // Right stick
      const rawRx = pad.axes[this.activeMapping.rightStick.xAxis] || 0;
      const rawRy = pad.axes[this.activeMapping.rightStick.yAxis] || 0;
      if (Math.abs(rawRx) > this.activeMapping.rightStick.deadzone) rx = rawRx;
      if (Math.abs(rawRy) > this.activeMapping.rightStick.deadzone) ry = rawRy;
    }

    return { bitmask, analog: { lx, ly, rx, ry } };
  }

  // Check if a specific button is pressed in a bitmask
  public static isButtonPressed(bitmask: number, button: PS1Button): boolean {
    return (bitmask & (1 << button)) !== 0;
  }
}

export const inputManager = new PS1InputManager();
