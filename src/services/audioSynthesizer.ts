// High precision Web Audio API Synthesizer for PS1 Sound Effects & Chiptune/Synthwave Combat 3 Audio

class PS1AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isMuted: boolean = false;
  private musicInterval: number | null = null;
  private isMusicPlaying: boolean = false;

  constructor() {
    // Lazy initialize on first interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(master: number, sfx: number, music: number, isMuted: boolean) {
    this.isMuted = isMuted;
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;

    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(isMuted ? 0 : Math.max(0, Math.min(1, master)), t, 0.05);
    this.sfxGain.gain.setTargetAtTime(Math.max(0, Math.min(1, sfx)), t, 0.05);
    this.musicGain.gain.setTargetAtTime(Math.max(0, Math.min(1, music)), t, 0.05);
  }

  // PS1 Boot Chime sound (classic harmonic bell and deep reverberation)
  public playPs1Boot() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Deep drone
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(55, t); // A1
    drone.frequency.exponentialRampToValueAtTime(110, t + 3.0);
    
    // Lowpass filter for smooth warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 2.5);

    droneGain.gain.setValueAtTime(0.01, t);
    droneGain.gain.linearRampToValueAtTime(0.3, t + 0.8);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);

    drone.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.sfxGain);

    drone.start(t);
    drone.stop(t + 4.5);

    // Chime harmonics
    const notes = [440, 659.25, 880, 1318.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const chime = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(freq, t + 0.3 * i);

      cGain.gain.setValueAtTime(0.001, t + 0.3 * i);
      cGain.gain.linearRampToValueAtTime(0.15 / (i + 1), t + 0.3 * i + 0.05);
      cGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);

      chime.connect(cGain);
      cGain.connect(this.sfxGain);

      chime.start(t + 0.3 * i);
      chime.stop(t + 3.5);
    });
  }

  // Machine Gun SFX (PS1 metallic snap)
  public playMachineGun() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const noise = this.ctx.createBufferSource();

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    // Pitch envelope
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    noise.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.05);
    noise.stop(t + 0.05);
  }

  // Missile Launch (Whoosh + low burn)
  public playMissileLaunch() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.35);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Explosion (Punchy crash + low rumble)
  public playExplosion() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.8);

    // Noise buffer
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.2));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.8);
    noise.stop(t + 0.8);
  }

  // Nitro Boost whoosh
  public playNitro() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(700, t + 0.25);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Pickup collect sound
  public playPickup() {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, t + 0.16); // G5
    osc.frequency.setValueAtTime(1046.5, t + 0.24); // C6

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // UI Beep / Menu Selection
  public playUiBlip(freq: number = 800) {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Start background Combat 3 retro synth soundtrack
  public startCombatMusic() {
    if (this.isMusicPlaying) return;
    this.initContext();
    if (!this.ctx || !this.musicGain) return;

    this.isMusicPlaying = true;
    let step = 0;
    const bassline = [110, 110, 130.81, 110, 146.83, 110, 98, 123.47]; // A minor Combat groove
    const arpNotes = [440, 523.25, 659.25, 880, 783.99, 659.25, 523.25, 392];

    const tempoMs = 135; // ~133 BPM 16th notes

    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.isMuted || !this.isMusicPlaying) return;
      const t = this.ctx.currentTime;

      // Bass punch
      const bassFreq = bassline[step % bassline.length];
      const bassOsc = this.ctx.createOscillator();
      const bassG = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq / 2, t);

      bassG.gain.setValueAtTime(0.15, t);
      bassG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      bassOsc.connect(bassG);
      bassG.connect(this.musicGain);

      bassOsc.start(t);
      bassOsc.stop(t + 0.13);

      // Hi-hat / cymbal tick on every beat
      if (step % 2 === 0) {
        const hhBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
        const data = hhBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const hh = this.ctx.createBufferSource();
        const hhGain = this.ctx.createGain();
        hh.buffer = hhBuffer;
        hhGain.gain.setValueAtTime(step % 4 === 2 ? 0.12 : 0.05, t);
        hhGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        hh.connect(hhGain);
        hhGain.connect(this.musicGain);
        hh.start(t);
        hh.stop(t + 0.04);
      }

      // Synth Arp lead on some beats
      if (step % 4 === 0 || step % 4 === 3) {
        const leadFreq = arpNotes[(step * 2) % arpNotes.length];
        const leadOsc = this.ctx.createOscillator();
        const leadG = this.ctx.createGain();
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, t);

        leadG.gain.setValueAtTime(0.08, t);
        leadG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

        leadOsc.connect(leadG);
        leadG.connect(this.musicGain);

        leadOsc.start(t);
        leadOsc.stop(t + 0.11);
      }

      step++;
    }, tempoMs);
  }

  public stopCombatMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundFx = new PS1AudioSynthesizer();
