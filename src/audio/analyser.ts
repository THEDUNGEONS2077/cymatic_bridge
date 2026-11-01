/**
 * src/audio/analyser.ts: the shared tab's sound into two analysers, left
 * and right.
 *
 * Layer: audio (Web Audio; no React, no stores). The graph:
 *   stream → MediaStreamSource → ChannelSplitter(2) → AnalyserNode L, R
 *          → a silent gain → the speakers
 *   stream → MediaStreamSource → a short AnalyserNode (mono, for beats)
 * The silent gain is only there so the graph is pulled every render
 * quantum: the page never plays the music (the tab does), it only listens.
 * A mono stream feeds its one channel to both analysers.
 *
 * Timing (the user, 0.1.1: "it doesn't really feel on time"; the visuals
 * lagged the sound). An analyser's window weighs its middle most, so what it
 * reports is about half a window old: fftSize 4096 lagged ~43 ms, so the
 * spectrum's pair now uses 2048 (~21 ms; bins 23 Hz apart, the lowest bands
 * read between them). Beats come from a separate short analyser, fftSize
 * 512 (~5 ms; coarse bins are fine for "did the low end just jump"), so a
 * kick is caught almost as it starts. The analysers' own smoothing is off:
 * SIGNAL smooths per scene (lib/signal/dynamics.ts).
 */
import type { AnalyserFrame } from '@/lib/signal/signal';

/** The spectrum analysers' FFT size (~21 ms of lag at 48 kHz). */
export const FFT_SIZE = 2048;
/** The beat analyser's FFT size (~5 ms of lag). */
export const FAST_FFT_SIZE = 512;

/** A live analyser on one stream. */
export interface Analyser {
  /** The analysers' bin counts (spectrum, beats) and the context's sample rate (for the SIGNAL engine). */
  binCount: number;
  fastBinCount: number;
  sampleRate: number;
  /** Reads this frame into the shared buffers (no allocation). */
  read(): AnalyserFrame;
  /** Listens to `stream` (LISTEN), or swaps to another (SWITCH), keeping the same context and buffers. */
  connect(stream: MediaStream): void;
  /** Lets the context sleep (the page is hidden) or wakes it. */
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): void;
}

/**
 * Makes the graph, with no stream yet (`connect` adds one). Call it inside
 * the click itself, before awaiting the picker: a context made after an
 * await can start suspended (no user activation left), and then every
 * analyser frame is silence. It's resumed here too, in the click.
 */
export function createAnalyser(): Analyser {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  void ctx.resume();
  const left = ctx.createAnalyser();
  const right = ctx.createAnalyser();
  for (const a of [left, right]) {
    a.fftSize = FFT_SIZE;
    a.smoothingTimeConstant = 0;
  }
  const fast = ctx.createAnalyser();
  fast.fftSize = FAST_FFT_SIZE;
  fast.smoothingTimeConstant = 0;
  const silent = ctx.createGain();
  silent.gain.value = 0;
  left.connect(silent);
  right.connect(silent);
  fast.connect(silent);
  silent.connect(ctx.destination);

  const frame: AnalyserFrame = {
    binsL: new Float32Array(left.frequencyBinCount),
    binsR: new Float32Array(right.frequencyBinCount),
    waveL: new Float32Array(FFT_SIZE),
    waveR: new Float32Array(FFT_SIZE),
    binsFast: new Float32Array(fast.frequencyBinCount),
  };
  let source: MediaStreamAudioSourceNode | null = null;
  let splitter: ChannelSplitterNode | null = null;

  /** Connects `s`'s audio to the analysers (replacing any before). */
  const connect = (s: MediaStream) => {
    source?.disconnect();
    splitter?.disconnect();
    source = ctx.createMediaStreamSource(s);
    splitter = ctx.createChannelSplitter(2);
    source.connect(splitter);
    // The beat analyser hears both channels mixed (an analyser downmixes its input).
    source.connect(fast);
    splitter.connect(left, 0);
    // A mono tab has no second channel: both analysers hear the first.
    const mono = s.getAudioTracks()[0]?.getSettings().channelCount === 1;
    splitter.connect(right, mono ? 0 : 1);
    // A share can arrive while the context sleeps (made in a click Chrome didn't count): wake it.
    if (ctx.state !== 'running') void ctx.resume();
  };

  return {
    binCount: left.frequencyBinCount,
    fastBinCount: fast.frequencyBinCount,
    sampleRate: ctx.sampleRate,
    read() {
      left.getFloatFrequencyData(frame.binsL);
      right.getFloatFrequencyData(frame.binsR);
      left.getFloatTimeDomainData(frame.waveL);
      right.getFloatTimeDomainData(frame.waveR);
      fast.getFloatFrequencyData(frame.binsFast!);
      return frame;
    },
    connect,
    suspend: () => ctx.suspend(),
    resume: () => ctx.resume(),
    close() {
      source?.disconnect();
      void ctx.close();
    },
  };
}
