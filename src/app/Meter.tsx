/**
 * src/app/Meter.tsx: the signal meter (D, R27): SIGNAL as numbers and bars,
 * for tuning by eye.
 *
 * Layer: UI (a Canvas 2D overlay). Bottom left: the 64 bands (left channel
 * up, right down, in the palette's frequency colours), the four groups,
 * the level, and two lights: the beat and the limited accent. Under it, a
 * line of figures: frames a second and the p95 drawing time (from the
 * stage's frame ring, once a second), the analysis cost per frame, flow,
 * idle, balance, beats so far, and the capture's state. It draws only while
 * open, at the screen's rate, off the stage's canvas.
 */
import { useEffect, useRef, useState } from 'react';

import { latestSignal } from '@/audio/listen';
import { percentile } from '@/lib/sharpness';
import { BANDS, OFFSET, scalar } from '@/lib/signal/layout';
import { sceneStats } from '@/scene/host';

import { useLive } from './useLive';

/** The meter's canvas size (CSS px). */
const W = 360;
const H = 150;

/** Reads a CSS colour token from <html>. */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

/** The meter overlay. */
export function Meter() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const capture = useLive((s) => s.capture);
  const [figures, setFigures] = useState('');

  // The bars, every frame while open.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    const accent = token('--accent');
    const cool = token('--cool');
    const dim = token('--line');
    const bright = token('--text-bright');
    let id = 0;
    const draw = () => {
      id = requestAnimationFrame(draw);
      const s = latestSignal();
      ctx.clearRect(0, 0, W, H);
      const mid = 60;
      const bw = 256 / BANDS;
      // Bands: left up, right down; colour from bass (accent) to treble (cool) by position.
      for (let i = 0; i < BANDS; i++) {
        ctx.fillStyle = i < BANDS / 2 ? accent : cool;
        ctx.globalAlpha = 0.55 + 0.45 * (1 - i / BANDS);
        const l = s[OFFSET.bandsL + i]! * 50;
        const r = s[OFFSET.bandsR + i]! * 50;
        ctx.fillRect(i * bw, mid - l, bw - 1, l);
        ctx.fillRect(i * bw, mid + 1, bw - 1, r);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dim;
      ctx.fillRect(0, mid, 256, 1);
      // Groups and level: five bars on the right.
      const bars = [scalar(s, 'bass'), scalar(s, 'lowMid'), scalar(s, 'highMid'), scalar(s, 'treble'), scalar(s, 'level')];
      bars.forEach((v, k) => {
        ctx.fillStyle = k === 4 ? bright : k < 2 ? accent : cool;
        ctx.fillRect(268 + k * 14, 110 - v * 100, 10, v * 100);
      });
      // Lights: the beat and the accent.
      ctx.fillStyle = accent;
      ctx.globalAlpha = scalar(s, 'beat');
      ctx.beginPath();
      ctx.arc(276, 128, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bright;
      ctx.globalAlpha = scalar(s, 'accent');
      ctx.beginPath();
      ctx.arc(300, 128, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);

  // The figures, once a second (setState from a timer, never during render).
  useEffect(() => {
    const update = async () => {
      const s = latestSignal();
      const stats = await sceneStats(1000);
      const fps = stats && stats.gaps.length ? (1000 * stats.gaps.length) / stats.gaps.reduce((a, b) => a + b, 0) : 0;
      const p95 = stats ? percentile(stats.durations, 0.95) : Number.NaN;
      setFigures(
        [
          `${fps.toFixed(0)} FPS`,
          `DRAW p95 ${Number.isFinite(p95) ? p95.toFixed(2) : '–'} MS`,
          `SIGNAL ${scalar(s, 'cost').toFixed(3)} MS`,
          `FLOW ${scalar(s, 'flow').toFixed(1)}`,
          `IDLE ${scalar(s, 'idle').toFixed(2)}`,
          `BAL ${scalar(s, 'balance').toFixed(2)}`,
          `BEATS ${scalar(s, 'beatCount').toFixed(0)}`,
          stats ? `${stats.w}×${stats.h}` : '',
        ].join(' · '),
      );
    };
    void update();
    const timer = setInterval(() => void update(), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="meter" aria-label="Signal meter">
      <canvas ref={canvas} className="meter-canvas" style={{ width: W, height: H }} aria-hidden="true" />
      <p className="meter-figures">
        {figures}
        {` · ${capture.toUpperCase()}`}
      </p>
    </aside>
  );
}
