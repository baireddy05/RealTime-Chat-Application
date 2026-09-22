// Web Audio API Apple Crystalline Glass Chime Generator for Pulse Chat

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.ringingInterval = null;
    const stored = typeof window !== "undefined" ? localStorage.getItem("pulse-sound-enabled") : null;
    this.muted = stored !== null ? stored === "false" : false;
  }

  initContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("pulse-sound-enabled", this.muted ? "false" : "true");
    }
  }

  // Apple-style Glass "Pop / Swoosh" sent sound
  playSendSound() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(1080, now + 0.07);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {}
  }

  // Apple-style Crystalline Glass Chime for incoming messages.
  // `tone` selects one of the per-chat notification tones (see CHAT_TONES).
  playReceiveSound(tone = "chime") {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      const playChimeNote = (freq, delay, dur, vol) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(vol, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + dur);
      };

      // [freq, delaySec, durSec, vol]
      const TONES = {
        chime: [
          [1046.5, 0.0, 0.35, 0.08], // C6
          [1318.5, 0.04, 0.4, 0.07], // E6
          [1567.9, 0.08, 0.5, 0.09], // G6
        ],
        bell: [
          [880.0, 0.0, 0.45, 0.09],
          [880.0, 0.28, 0.5, 0.06],
        ],
        pop: [
          [660.0, 0.0, 0.08, 0.09],
          [990.0, 0.06, 0.14, 0.09],
        ],
        marimba: [
          [523.25, 0.0, 0.2, 0.09], // C5
          [783.99, 0.12, 0.32, 0.08], // G5
        ],
      };
      (TONES[tone] || TONES.chime).forEach(([f, d, dur, v]) => playChimeNote(f, d, dur, v));
    } catch {}
  }

  // Notification chime for alerts / requests
  playAlertSound() {
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  // WebRTC Calling Ringtones
  playIncomingRing() {
    this.stopRinging();
    if (this.muted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const playPattern = () => {
        if (!this.ctx || this.ringingInterval === null) return;
        const now = this.ctx.currentTime;
        const notes = [
          { f: 523.25, t: 0.0, d: 0.15 }, // C5
          { f: 659.25, t: 0.15, d: 0.15 }, // E5
          { f: 783.99, t: 0.3, d: 0.18 }, // G5
          { f: 1046.5, t: 0.48, d: 0.3 }, // C6
        ];

        notes.forEach(({ f, t, d }) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + t);
          gain.gain.setValueAtTime(0.08, now + t);
          gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + t);
          osc.stop(now + t + d + 0.02);
        });
      };

      playPattern();
      this.ringingInterval = setInterval(playPattern, 2200);
    } catch {}
  }

  playOutgoingRing() {
    this.stopRinging();
    if (this.muted) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const playPulse = () => {
        if (!this.ctx || this.ringingInterval === null) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.25);
      };

      playPulse();
      this.ringingInterval = setInterval(playPulse, 3000);
    } catch {}
  }

  stopRinging() {
    if (this.ringingInterval) {
      clearInterval(this.ringingInterval);
      this.ringingInterval = null;
    }
  }

  playCallEndSound() {
    this.stopRinging();
    if (this.muted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.25);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }
}

export const soundManager = new SoundEffects();

// Per-chat notification tones (ids stored in chatPreferences.tone)
export const CHAT_TONES = [
  { id: "chime", name: "Glass Chime" },
  { id: "bell", name: "Bell" },
  { id: "pop", name: "Pop" },
  { id: "marimba", name: "Marimba" },
];
