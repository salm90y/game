import Peer, { DataConnection } from 'peerjs';
import { InputFrame, NetplayRole, NetplaySessionState } from '../types';

export class NetplayCoordinator {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private state: NetplaySessionState = {
    role: 'offline_single',
    roomCode: '',
    isConnected: false,
    isConnecting: false,
    peerId: null,
    opponentPeerId: null,
    opponentName: 'اللاعب 2',
    ping: 0,
    jitter: 0,
    frameDelay: 2,
    rollbackFrames: 4,
    packetLoss: 0,
    syncProgress: 100,
    errorMessage: null,
  };

  private stateListeners: Array<(state: NetplaySessionState) => void> = [];
  private remoteFrameQueue: Map<number, InputFrame> = new Map();
  private lastSentFrame: number = 0;
  private pingTimestamp: number = 0;
  private pingInterval: number | null = null;
  private pingSamples: number[] = [];

  constructor() {
    //
  }

  public subscribe(callback: (state: NetplaySessionState) => void) {
    this.stateListeners.push(callback);
    callback(this.state);
    return () => {
      this.stateListeners = this.stateListeners.filter(cb => cb !== callback);
    };
  }

  private notify() {
    const copy = { ...this.state };
    this.stateListeners.forEach(cb => cb(copy));
  }

  // Generate 6-char clean alphanumeric room code
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CB';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(customCode?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const roomCode = customCode || this.generateRoomCode();
      const peerId = `ps1-combat3-room-${roomCode.toLowerCase()}`;

      this.cleanup();
      this.state.role = 'host';
      this.state.roomCode = roomCode;
      this.state.isConnecting = true;
      this.state.errorMessage = null;
      this.notify();

      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          this.state.peerId = id;
          this.state.isConnecting = false;
          this.notify();
          resolve(roomCode);
        });

        this.peer.on('connection', (conn) => {
          this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('Peer error (host):', err);
          if (err.type === 'unavailable-id') {
            // Retry with new code
            const newCode = this.generateRoomCode();
            this.createRoom(newCode).then(resolve).catch(reject);
          } else {
            this.state.isConnecting = false;
            this.state.errorMessage = `خطأ في إنشاء الغرفة: ${err.type}`;
            this.notify();
            reject(err);
          }
        });
      } catch (e) {
        this.state.isConnecting = false;
        this.state.errorMessage = 'تعذر بدء بروتوكول Netplay';
        this.notify();
        reject(e);
      }
    });
  }

  public joinRoom(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const targetPeerId = `ps1-combat3-room-${cleanCode.toLowerCase()}`;
      const myPeerId = `ps1-client-${Math.random().toString(36).substring(2, 9)}`;

      this.cleanup();
      this.state.role = 'client';
      this.state.roomCode = cleanCode;
      this.state.isConnecting = true;
      this.state.errorMessage = null;
      this.notify();

      try {
        this.peer = new Peer(myPeerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(targetPeerId, {
            reliable: false, // UDP-like low latency data channel for games
          });
          this.handleConnection(conn);
          resolve();
        });

        this.peer.on('error', (err) => {
          console.warn('Peer error (join):', err);
          this.state.isConnecting = false;
          this.state.errorMessage = `تعذر العثور على الغرفة (${cleanCode})`;
          this.notify();
          reject(err);
        });
      } catch (e) {
        this.state.isConnecting = false;
        this.state.errorMessage = 'فشل الاتصال بالخادم الوسيط';
        this.notify();
        reject(e);
      }
    });
  }

  private handleConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.opponentPeerId = conn.peer;
      this.state.errorMessage = null;
      this.notify();
      this.startPingLoop();

      // Handshake
      this.sendNetplayPacket({
        type: 'handshake',
        name: this.state.role === 'host' ? 'المضيف (P1)' : 'اللاعب المنضم (P2)',
        role: this.state.role,
        time: Date.now()
      });
    });

    conn.on('data', (data: unknown) => {
      this.handleIncomingData(data);
    });

    conn.on('close', () => {
      this.state.isConnected = false;
      this.state.errorMessage = 'تم قطع الاتصال بالطرف الآخر';
      this.notify();
      this.stopPingLoop();
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
      this.state.errorMessage = 'خطأ في قناة البيانات P2P';
      this.notify();
    });
  }

  private handleIncomingData(data: unknown) {
    if (!data || typeof data !== 'object') return;
    const packet = data as Record<string, unknown>;

    if (packet.type === 'ping') {
      this.sendNetplayPacket({ type: 'pong', time: packet.time });
    } else if (packet.type === 'pong') {
      const rtt = Date.now() - (packet.time as number);
      this.recordPing(rtt);
    } else if (packet.type === 'handshake') {
      if (packet.name) {
        this.state.opponentName = String(packet.name);
        this.notify();
      }
    } else if (packet.type === 'frame') {
      const frameData = packet.frame as InputFrame;
      if (frameData && typeof frameData.frame === 'number') {
        this.remoteFrameQueue.set(frameData.frame, frameData);
      }
    }
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = window.setInterval(() => {
      if (this.connection && this.connection.open) {
        this.pingTimestamp = Date.now();
        this.sendNetplayPacket({ type: 'ping', time: this.pingTimestamp });
      }
    }, 1000);
  }

  private stopPingLoop() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private recordPing(rtt: number) {
    this.pingSamples.push(rtt);
    if (this.pingSamples.length > 10) this.pingSamples.shift();

    const avgPing = Math.round(this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length);
    const variance = this.pingSamples.reduce((a, b) => a + Math.abs(b - avgPing), 0) / this.pingSamples.length;

    this.state.ping = avgPing;
    this.state.jitter = Math.round(variance);

    // Calculate adaptive delay (1 frame = 16.6ms)
    // For 0-35ms ping: 1 frame delay
    // For 36-70ms ping: 2 frames delay
    // For 70ms+ ping: 3-4 frames delay
    this.state.frameDelay = Math.max(1, Math.min(5, Math.ceil((avgPing / 2) / 16.6)));
    this.notify();
  }

  public sendFrameInput(frame: InputFrame) {
    this.lastSentFrame = frame.frame;
    if (this.connection && this.connection.open) {
      this.sendNetplayPacket({
        type: 'frame',
        frame,
      });
    }
  }

  public getOpponentFrame(frameNumber: number): InputFrame | null {
    if (this.remoteFrameQueue.has(frameNumber)) {
      return this.remoteFrameQueue.get(frameNumber) || null;
    }
    // Rollback prediction: If not received yet, return predicted input from closest previous frame
    let closestFrame = frameNumber - 1;
    while (closestFrame > 0 && closestFrame >= frameNumber - this.state.rollbackFrames) {
      if (this.remoteFrameQueue.has(closestFrame)) {
        const prev = this.remoteFrameQueue.get(closestFrame)!;
        return {
          ...prev,
          frame: frameNumber, // Predicted frame
        };
      }
      closestFrame--;
    }
    return null;
  }

  public clearOldFrames(beforeFrame: number) {
    for (const key of this.remoteFrameQueue.keys()) {
      if (key < beforeFrame - 60) {
        this.remoteFrameQueue.delete(key);
      }
    }
  }

  private sendNetplayPacket(data: Record<string, unknown>) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(data);
      } catch (err) {
        console.warn('Failed to send packet:', err);
      }
    }
  }

  public setOfflineMode(mode: 'offline_single' | 'offline_vs') {
    this.cleanup();
    this.state.role = mode;
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.roomCode = '';
    this.state.errorMessage = null;
    this.notify();
  }

  public cleanup() {
    this.stopPingLoop();
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.remoteFrameQueue.clear();
    this.pingSamples = [];
    this.state.isConnected = false;
    this.state.isConnecting = false;
  }
}

export const netplayCoordinator = new NetplayCoordinator();
