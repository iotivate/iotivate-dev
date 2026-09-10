/**
 * A two-tone siren synthesized with the Web Audio API — no audio asset needed.
 * Used to make an active alarm audible in the browser.
 *
 * Browsers block audio until a user gesture, so call unlock() from a click/tap
 * once (e.g. on first interaction with the page); after that start()/stop() work
 * even for an alarm that fires without a fresh gesture.
 */
export class Siren {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private sweep: ReturnType<typeof setInterval> | null = null;
  private playing = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  /** Resume the audio context in response to a user gesture. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  start(): void {
    if (this.playing) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.start();

    // Alternate between two tones for the classic siren wail.
    let high = false;
    this.sweep = setInterval(() => {
      if (!this.ctx || !this.osc) return;
      high = !high;
      this.osc.frequency.setValueAtTime(high ? 960 : 660, this.ctx.currentTime);
    }, 450);

    this.osc = osc;
    this.gain = gain;
    this.playing = true;
  }

  stop(): void {
    if (!this.playing) return;
    if (this.sweep) {
      clearInterval(this.sweep);
      this.sweep = null;
    }
    const ctx = this.ctx;
    if (ctx && this.gain && this.osc) {
      try {
        this.gain.gain.cancelScheduledValues(ctx.currentTime);
        this.gain.gain.setValueAtTime(this.gain.gain.value, ctx.currentTime);
        this.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        this.osc.stop(ctx.currentTime + 0.15);
      } catch {
        /* already stopped */
      }
    }
    this.osc = null;
    this.gain = null;
    this.playing = false;
  }
}
