// e2e/walk.mjs: cymatic_bridge end to end in Chromium (`npm run e2e`, after `npm run build`).
//
// cyberdeck_terminal's harness: serves dist/ with the serve binary itself
// (not `npx serve`, whose child would outlive it), on 127.0.0.1 only, and
// always stops it. Each path runs in order on the same page, building on
// the one before; screens go to e2e/screenshots/ for review.
//
// The music: a test tab (routed, never on disk) titled CB-TEST plays a
// WebAudio loop: a kick every 0.5 s (120 BPM) over a quiet 440 Hz tone.
// Chrome's --auto-select-tab-capture-source-by-title picks it in the share
// picker, so LISTEN runs the real capture path with no hands.
//
// Headless Chrome captures a tab's audio as silence (peak 0: no audio
// output to tap, 2026-10-31), so the walk runs headed when there's a
// display (WSLg's here): a Chromium window shows briefly. CB_HEADLESS=1
// runs headless instead, and the sound checks are skipped (said so).
//
// The test tabs are opened before the page: a CB-TEST tab opened after it
// was never picked (the picker stayed open, 2026-10-31). Two are opened,
// and the picker may take either; so STOP is walked first, and the last
// sharing path closes both (the share ends with its tab).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'e2e/screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 8173;
const PAGE = `http://127.0.0.1:${PORT}/`;
const TONE = `http://127.0.0.1:${PORT}/__test/tone.html`;

const server = spawn(join(root, 'node_modules/.bin/serve'), [join(root, 'dist'), '-l', `tcp://127.0.0.1:${PORT}`, '--no-port-switching'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try {
    await fetch(PAGE);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Full Chromium (the headless shell can't share tabs), its picker answered by title, sound allowed to start on its own.
const HEADED = !!process.env.DISPLAY && !process.env.CB_HEADLESS;
const browser = await chromium.launch({
  channel: 'chromium',
  headless: !HEADED,
  args: ['--auto-select-tab-capture-source-by-title=CB-TEST', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
// The test tab: a kick at 120 BPM over a quiet tone, made in the page.
await context.route(TONE, (route) =>
  route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><title>CB-TEST</title><body style="background:#000"><script>
      const ctx = new AudioContext();
      const tone = ctx.createOscillator(); const tg = ctx.createGain(); tg.gain.value = 0.05;
      tone.frequency.value = 440; tone.connect(tg).connect(ctx.destination); tone.start();
      // A kick: a sine falling from 120 to 45 Hz, loud then gone in 0.25 s, every 0.5 s.
      function kick(at) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.2);
        g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
        o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.3);
      }
      // Queued 3 s ahead: a background tab's timers run about once a second, and a gap in the queue is a missing kick.
      let next = ctx.currentTime + 0.1;
      const fill = () => { while (next < ctx.currentTime + 3) { kick(next); next += 0.5; } };
      fill();
      setInterval(fill, 250);
    </script></body>`,
  }),
);
// The two test tabs first (see above), then the page.
const tones = [await context.newPage(), await context.newPage()];
for (const t of tones) await t.goto(TONE);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.text()) && errors.push(m.text()));
let failed = 0;

/** One check: runs the steps, then fails on any page error. */
async function path(name, fn) {
  try {
    await fn();
    if (errors.length) throw new Error(`page error: ${errors.splice(0).join(' | ')}`);
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✕ ${name}: ${process.env.WALK_DEBUG ? e.message : e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(shots, `FAILED-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`) }).catch(() => {});
  }
}

/** The latest SIGNAL frame's scalars, by name (lib/signal/layout.ts). */
const NAMES = ['level', 'bass', 'lowMid', 'highMid', 'treble', 'beat', 'beatCount', 'accent', 'flow', 'balance', 'idle', 'cost'];
async function scalars() {
  const s = await page.evaluate(() => window.__cymaticSignal.latest());
  const at = 64 * 2 + 64;
  return Object.fromEntries(NAMES.map((n, i) => [n, s[at + i]]));
}

/** Waits until `test(scalars)` holds (polling), or fails after `ms`. */
async function until(test, ms, what) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await scalars();
    if (test(last)) return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`${what}: never (last ${JSON.stringify(last)})`);
}

const stage = (fn, arg) => page.evaluate(([f, a]) => window.__cymaticStage[f](a), [fn, arg]);

try {
  await path('opens: the stage draws the idle breath before LISTEN', async () => {
    await page.goto(PAGE);
    await page.waitForSelector('#scene-canvas[data-ready]', { timeout: 10000 });
    await page.waitForSelector('.topbar');
    const s = await scalars();
    if (s.idle < 0.99) throw new Error(`not idle: ${s.idle}`);
    if (s.level < 0.02) throw new Error('no breath');
    const px = await stage('pixels');
    if (px.lit < 0.002) throw new Error(`nothing drawn: ${JSON.stringify(px)}`);
    await page.screenshot({ path: join(shots, '01-idle.png') });
  });

  await path('axe: no WCAG 2.2 A/AA problems', async () => {
    await page.addScriptTag({ content: readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8') });
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }));
    if (r.violations.length) throw new Error(r.violations.map((v) => `${v.id}: ${v.nodes.length}`).join(', '));
  });

  await path('LISTEN, then STOP: the test tab is shared, STOP ends it and the scene goes idle', async () => {
    await page.bringToFront();
    await page.getByRole('button', { name: 'LISTEN' }).click();
    await page.getByRole('button', { name: 'STOP' }).click({ timeout: 10000 });
    await page.getByRole('button', { name: 'LISTEN' }).waitFor();
    await until((s) => s.idle > 0.9, 6000, 'idle after STOP');
  });

  await path('LISTEN again: the signal wakes, kicks are beats, bass over treble; closing the shared tab ends the share', async () => {
    await page.bringToFront();
    await page.getByRole('button', { name: 'LISTEN' }).click();
    await page.getByRole('button', { name: 'STOP' }).waitFor({ timeout: 10000 });
    if (!HEADED) {
      console.log('    (headless: the shared tab is silent here, so the sound checks are skipped)');
      for (const t of tones) await t.close();
      await page.getByRole('button', { name: 'LISTEN' }).waitFor({ timeout: 5000 });
      return;
    }
    const woke = await until((s) => s.idle < 0.2, 8000, 'wake');
    const before = woke.beatCount;
    await page.waitForTimeout(4000);
    const s = await scalars();
    // 4 s at 120 BPM is 8 kicks; allow a missed one or two at the edges.
    if (s.beatCount - before < 6) throw new Error(`beats: ${s.beatCount - before} in 4 s`);
    if (s.bass <= s.treble) throw new Error(`bass ${s.bass} ≤ treble ${s.treble}`);
    await page.screenshot({ path: join(shots, '02-listening.png') });
    for (const t of tones) await t.close();
    // Closing the shared tab ends the share: back to LISTEN, easing into idle (R7).
    await page.getByRole('button', { name: 'LISTEN' }).waitFor({ timeout: 5000 });
    await until((s) => s.idle > 0.9, 6000, 'idle after the tab closed');
  });

  await path('D: the signal meter opens and closes', async () => {
    await page.keyboard.press('d');
    await page.getByRole('complementary', { name: 'Signal meter' }).waitFor();
    await page.waitForTimeout(1200);
    const text = await page.locator('.meter-figures').textContent();
    if (!/FPS/.test(text ?? '')) throw new Error(`figures: ${text}`);
    await page.screenshot({ path: join(shots, '03-meter.png') });
    await page.keyboard.press('d');
    await page.getByRole('complementary', { name: 'Signal meter' }).waitFor({ state: 'detached' });
  });

  await path('H: hides and shows the HUD, kept across a reload', async () => {
    await page.keyboard.press('h');
    await page.locator('.topbar').waitFor({ state: 'detached' });
    await page.evaluate(() => window.__cymatic.flush());
    await page.reload();
    await page.waitForSelector('#scene-canvas[data-ready]');
    await page.waitForTimeout(500);
    if (await page.locator('.topbar').count()) throw new Error('the HUD came back after a reload');
    await page.keyboard.press('h');
    await page.locator('.topbar').waitFor();
  });

  await path('← / →: step scenes without errors', async () => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(800);
    if ((await stage('scene')) !== 'test') throw new Error('wrong scene');
  });

  await path('hidden: nothing is drawn, and it resumes on return (R17)', async () => {
    const hide = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await hide(true);
    await page.waitForTimeout(600);
    const s = await stage('stats', 400);
    if (s.running || s.durations.length > 1) throw new Error(`still drawing: ${s.durations.length} frames`);
    if (await page.evaluate(() => window.__cymaticSignal.running())) throw new Error('the listen loop still runs');
    await hide(false);
    await page.waitForTimeout(600);
    const back = await stage('stats', 400);
    if (back.durations.length < 5) throw new Error('didn’t resume');
  });

  await path('a lost graphics context comes back and draws again', async () => {
    await stage('lose');
    await page.waitForTimeout(1500);
    const s = await stage('stats', 500);
    if (s.durations.length < 5) throw new Error('not drawing after the restore');
    const px = await stage('pixels');
    if (px.lit < 0.002) throw new Error('blank after the restore');
  });

  await path('speed: drawing and analysis cost (reported, not judged: headless has no GPU)', async () => {
    const s = await stage('stats', 2000);
    const sorted = [...s.durations].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? NaN;
    const fps = (1000 * s.gaps.length) / s.gaps.reduce((a, b) => a + b, 0);
    const sig = await scalars();
    console.log(`    ${fps.toFixed(0)} fps, draw p95 ${p95.toFixed(2)} ms (CPU side), signal ${sig.cost.toFixed(3)} ms a frame, canvas ${s.w}×${s.h}`);
  });
} finally {
  await browser.close();
  server.kill();
}

console.log(failed ? `\n${failed} path(s) failed` : '\nall paths passed');
process.exit(failed ? 1 : 0);
