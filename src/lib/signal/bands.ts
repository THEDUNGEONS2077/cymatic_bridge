/**
 * src/lib/signal/bands.ts: from an FFT's bins to SIGNAL's 64 log-spaced
 * bands.
 *
 * Layer: pure lib (tested). The analyser gives decibels per bin, evenly
 * spaced in Hz (fftSize 4096 at 48 kHz: 11.7 Hz apart). Music lives on a
 * log scale (an octave is a doubling), so the bands are log-spaced: each
 * is about 1/7 of an octave wide. Low bands are narrower than a bin, so
 * they read the spectrum between bins (interpolated); higher bands span
 * many bins and average their power.
 *
 * The tilt: music's spectrum falls by about 3–4.5 dB an octave (pink-ish),
 * so raw bands would show bass loud and treble faint. The user asked for
 * the range to weigh evenly (R20), so each band is lifted by TILT_DB_PER_OCTAVE
 * per octave above 1 kHz (and lowered below it), which levels typical music.
 */
import { BAND_HIGH_HZ, BAND_LOW_HZ } from './layout';

/** How much each octave above 1 kHz is lifted (dB): levels music's typical pink-ish fall. */
export const TILT_DB_PER_OCTAVE = 3.5;
/** The quietest a bin is taken to be (dB): the analyser reports -Infinity for digital silence. */
export const FLOOR_DB = -120;

/** One band: where it reads the bins. */
export interface BandSpan {
  /** Its lower and upper edge (Hz) and its centre (geometric). */
  lowHz: number;
  highHz: number;
  centreHz: number;
  /** The fractional bin positions of its edges. */
  from: number;
  to: number;
  /** Its tilt (dB), added to its level. */
  tiltDb: number;
}

/**
 * The bands' spans for an analyser of `binCount` bins at `sampleRate` Hz:
 * `count` bands log-spaced from `lowHz` to `highHz`. Worked out once per
 * analyser, not per frame.
 */
export function bandSpans(count: number, binCount: number, sampleRate: number, lowHz = BAND_LOW_HZ, highHz = BAND_HIGH_HZ): BandSpan[] {
  // Bin i is centred on i × (sampleRate / fftSize), with fftSize = 2 × binCount.
  const hzPerBin = sampleRate / (binCount * 2);
  const ratio = Math.pow(highHz / lowHz, 1 / count);
  const spans: BandSpan[] = [];
  for (let i = 0; i < count; i++) {
    const lo = lowHz * Math.pow(ratio, i);
    const hi = lo * ratio;
    const centre = Math.sqrt(lo * hi);
    spans.push({
      lowHz: lo,
      highHz: hi,
      centreHz: centre,
      from: lo / hzPerBin,
      to: Math.min(binCount - 1, hi / hzPerBin),
      tiltDb: TILT_DB_PER_OCTAVE * Math.log2(centre / 1000),
    });
  }
  return spans;
}

/** Decibels to power (1 = 0 dB). */
const power = (db: number) => Math.pow(10, Math.max(FLOOR_DB, db) / 10);

/** The analyser's value at fractional bin `x`, interpolated in power between the two bins round it. */
function between(bins: Float32Array, x: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const a = power(bins[i] ?? FLOOR_DB);
  const b = power(bins[i + 1] ?? FLOOR_DB);
  return a + (b - a) * t;
}

/**
 * Each band's level (dB, tilt added) from one analyser frame of decibels
 * per bin, written into `out` (no allocation: called every frame).
 */
export function readBands(bins: Float32Array, spans: readonly BandSpan[], out: Float32Array): void {
  for (let b = 0; b < spans.length; b++) {
    const s = spans[b]!;
    let p: number;
    if (s.to - s.from < 1) {
      // Narrower than a bin: read the spectrum at its centre, between bins.
      p = between(bins, (s.from + s.to) / 2);
    } else {
      // Wider: the mean power of the bins it covers (whole bins only; its edges are a bin's rounding).
      let sum = 0;
      let n = 0;
      for (let i = Math.round(s.from); i <= Math.round(s.to); i++) {
        sum += power(bins[i] ?? FLOOR_DB);
        n++;
      }
      p = n ? sum / n : power(FLOOR_DB);
    }
    out[b] = 10 * Math.log10(Math.max(p, 1e-30)) + s.tiltDb;
  }
}

/** The indices of the bands whose centres fall in [lowHz, highHz): the four groups (bass, low mids…). */
export function bandRange(spans: readonly BandSpan[], lowHz: number, highHz: number): [number, number] {
  let from = spans.length;
  let to = 0;
  spans.forEach((s, i) => {
    if (s.centreHz >= lowHz && s.centreHz < highHz) {
      from = Math.min(from, i);
      to = Math.max(to, i + 1);
    }
  });
  return from < to ? [from, to] : [0, 0];
}
