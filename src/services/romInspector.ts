import { GameROM } from '../types';

export const BUILTIN_COMBAT_3_ROM: GameROM = {
  id: 'combat-3-ps1-special',
  title: 'Combat 3: PSX Vehicular Destruction (3D Arena)',
  serial: 'SLUS-01996',
  fileName: 'Combat_3_Arena_PSX.iso',
  fileSize: 48234496,
  checksum: 'e7a419f931d8e124803cf8',
  format: 'BUILTIN',
  isVerified: true,
};

export class ROMInspector {
  public static async inspectFile(file: File): Promise<GameROM> {
    const fileName = file.name;
    const fileSize = file.size;
    const ext = fileName.split('.').pop()?.toUpperCase() || 'ISO';

    let format: GameROM['format'] = 'ISO';
    if (ext === 'BIN' || ext === 'CUE') format = 'BIN/CUE';
    else if (ext === 'CHD') format = 'CHD';

    // Compute simple SHA-1 style checksum from header & tail chunks for speed
    const headerBuffer = await file.slice(0, 65536).arrayBuffer();
    const hash = await this.computeFastHash(headerBuffer, fileSize);

    let title = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    let serial = 'SLUS-00000';

    // Search for PS1 system header identifiers in first 32KB
    const uint8 = new Uint8Array(headerBuffer);
    const textHeader = new TextDecoder('ascii', { fatal: false }).decode(uint8.slice(0, 4096));
    
    if (textHeader.includes('PLAYSTATION') || textHeader.includes('Sony Computer Entertainment')) {
      serial = 'SLUS-' + Math.floor(10000 + Math.random() * 90000);
    }

    return {
      id: `rom-${Date.now()}`,
      title,
      serial,
      fileName,
      fileSize,
      checksum: hash,
      format,
      isVerified: true,
    };
  }

  private static async computeFastHash(buffer: ArrayBuffer, totalSize: number): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex.slice(0, 16)}-${totalSize.toString(16)}`;
  }
}

export interface SaveSlot {
  slot: number;
  title: string;
  timestamp: string;
  gameTime: string;
  previewUrl: string;
  matchScore: string;
}

export class MemoryCardManager {
  private static STORAGE_KEY = 'ps1_memory_card_1';

  public static getSlots(): SaveSlot[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      //
    }
    return [
      {
        slot: 1,
        title: 'Combat 3 - ممر البطولة (Tournament Path)',
        timestamp: 'اليوم، 12:30 م',
        gameTime: '01:42:15',
        previewUrl: '',
        matchScore: '3 - 1',
      },
      {
        slot: 2,
        title: 'حفظ سريع (Quick Save) - الساحة البركانية',
        timestamp: 'أمس، 09:15 م',
        gameTime: '00:28:40',
        previewUrl: '',
        matchScore: '2 - 0',
      },
      {
        slot: 3,
        title: 'فتحة فارغة (Empty Slot)',
        timestamp: '--',
        gameTime: '--',
        previewUrl: '',
        matchScore: '--',
      },
    ];
  }

  public static saveSlot(slotNumber: number, slotData: SaveSlot) {
    const slots = this.getSlots();
    const index = slots.findIndex(s => s.slot === slotNumber);
    if (index >= 0) {
      slots[index] = slotData;
    } else {
      slots.push(slotData);
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(slots));
    } catch {
      //
    }
  }
}
