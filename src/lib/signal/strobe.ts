/**
 * src/lib/signal/strobe.ts: the beat accent, limited so it can never strobe.
 *
 * Layer: pure lib (tested).
 *
 * The accent is the one value a scene may use to flash the whole picture
 * (the beat accent, R22). The user asked for no fast strobing (R18), and
 * the accessibility rule is no more than three flashes in any second
 * (WCAG 2.3.1). So an accent fires only on a strong beat
 * (MIN_STRENGTH), never sooner than MIN_GAP_S after the last one, and it
 * never goes above MAX_ACCENT. It decays over DECAY_S, so a flash has
 * faded well before the next can start. Beats that come too fast still
 * pulse the scene through the beat value; only the full flash is held back.
 */

/**
 * The shortest time between two accents (s): at most three in any second.
 * A touch over 1/3, so a closed one-second window can never hold four
 * (flashes at 0, 1/3, 2/3 and 1 would be four).
 */
export const MIN_GAP_S = 0.34;
/** The weakest beat that fires an accent (beat strengths are 0.5..1). */
export const MIN_STRENGTH = 0.6;
/** The brightest an accent may be (0..1). */
export const MAX_ACCENT = 0.8;
/** How fast it fades (s, time constant): down to 20% within MIN_GAP_S. */
export const DECAY_S = 0.2;

/** The limiter's state. */
export interface Strobe {
  value: number;
  /** Seconds since the last accent fired. */
  since: number;
}

/** A new limiter, dark. */
export function newStrobe(): Strobe {
  return { value: 0, since: Infinity };
}

/**
 * One frame of `dt` seconds with a beat of `strength` (0: none this
 * frame). Returns the accent, 0..MAX_ACCENT.
 */
export function stepStrobe(s: Strobe, strength: number, dt: number): number {
  s.since += dt;
  s.value *= Math.exp(-dt / DECAY_S);
  if (strength >= MIN_STRENGTH && s.since >= MIN_GAP_S) {
    s.value = MAX_ACCENT * strength;
    s.since = 0;
  }
  return s.value;
}
