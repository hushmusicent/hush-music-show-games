// WebAudio Sound engine

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = typeof window !== 'undefined' ? localStorage.getItem('shg_muted') === '1' : false;

  public ensure() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public beep(f?: number, d?: number, type: OscillatorType = 'sine') {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f || 440;
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (d || 0.12));
      o.stop(this.ctx.currentTime + (d || 0.12));
    } catch (e) {}
  }

  public click() {
    this.beep(600, 0.06, 'square');
  }

  public win() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.15), i * 110);
    });
  }

  public lose() {
    [400, 300, 220].forEach((f, i) => {
      setTimeout(() => this.beep(f, 0.18, 'sawtooth',), i * 130);
    });
  }

  public toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('shg_muted', this.muted ? '1' : '0');
    } catch (e) {}
    return this.muted;
  }
}

export const Sound = new SoundEngine();
