// Web Audio API Apple Crystalline Glass Chime Generator for Pulse Chat

class SoundEffects {
  constructor() {
    this.ctx = null;
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

  // Apple-style Crystalline Glass Chime for incoming messages (C6 - E6 - G6 chord)
  playReceiveSound() {
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

      // Crystalline triple-tone glass refraction
      playChimeNote(1046.5, 0.00, 0.35, 0.08); // C6
      playChimeNote(1318.5, 0.04, 0.40, 0.07); // E6
      playChimeNote(1567.9, 0.08, 0.50, 0.09); // G6
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
}

export const soundManager = new SoundEffects();
