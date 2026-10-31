/**
 * src/audio/analyser.ts: the shared tab's sound into two analysers, left
 * and right.
 *
 * Layer: audio (Web Audio; no React, no stores). The graph:
 *   stream → MediaStreamSource → ChannelSplitter(2) → AnalyserNode L, R
 *          → a silent gain → the speakers
 * The silent gain is only there so the graph is pulled every render
 * quantum: the page never plays the music (the tab does), it only listens.
 * A mono stream feeds its one channel to both analysers.
 *
 * fftSize 4096 gives 2048 bins, 11.7 Hz apart at 48 kHz: fine enough for
 * the lowest bands (30 Hz). The analysers' own smoothing is off: SIGNAL
 * smooths per scene (lib/signal/dynamics.ts).
 */
import type { AnalyserFrame } from '@/lib/signal/signal';

/** The analysers' FFT size. */
export const FFT_SIZE = 4096;

/** A live analyser on one stream. */
export interface Analyser {
  /** The analysers' bin count and the context's sample rate (for the SIGNAL engine). */
  binCount: number;
  sampleRate: number;
  /** Reads this frame into the shared buffers (no allocation). */
  read(): AnalyserFrame;
  /** Swaps to another stream (SWITCH), keeping the same context and buffers. */
  connect(stream: MediaStream): void;
  /** Lets the context sleep (the page is hidden) or wakes it. */
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): void;
}

/** Makes the graph for `stream`. Must start inside a click (the browser lets audio start only then). */
export function createAnalyser(stream: MediaStream): Analyser {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const left = ctx.createAnalyser();
  const right = ctx.createAnalyser();
  for (const a of [left, right]) {
    a.fftSize = FFT_SIZE;
    a.smoothingTimeConstant = 0;
  }
  const silent = ctx.createGain();
  silent.gain.value = 0;
  left.connect(silent);
  right.connect(silent);
  silent.connect(ctx.destination);

  const frame: AnalyserFrame = {
    binsL: new Float32Array(left.frequencyBinCount),
    binsR: new Float32Array(right.frequencyBinCount),
    waveL: new Float32Array(FFT_SIZE),
    waveR: new Float32Array(FFT_SIZE),
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
    splitter.connect(left, 0);
    // A mono tab has no second channel: both analysers hear the first.
    const mono = s.getAudioTracks()[0]?.getSettings().channelCount === 1;
    splitter.connect(right, mono ? 0 : 1);
  };
  connect(stream);

  return {
    binCount: left.frequencyBinCount,
    sampleRate: ctx.sampleRate,
    read() {
      left.getFloatFrequencyData(frame.binsL);
      right.getFloatFrequencyData(frame.binsR);
      left.getFloatTimeDomainData(frame.waveL);
      right.getFloatTimeDomainData(frame.waveR);
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
