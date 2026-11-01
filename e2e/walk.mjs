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
// runs headless instead: there the page's getDisplayMedia is replaced by a
// stream made in the page (the same kicks over a tone, as WebAudio, and a
// blank video track), so the analysis, beats and scenes still hear music;
// only the picker itself and "closing the shared tab ends the share" go
// unchecked (said so).
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
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
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
        window.kicks.push(at);
      }
      // Every kick's start, in the audio clock; kickTimes() maps them to epoch ms at the speakers (for the beat latency).
      window.kicks = [];
      window.kickTimes = () => { const ts = ctx.getOutputTimestamp(); return window.kicks.map((k) => performance.timeOrigin + ts.performanceTime + (k - ts.contextTime) * 1000); };
      // Queued 3 s ahead: a background tab's timers run about once a second, and a gap in the queue is a missing kick.
      let next = ctx.currentTime + 0.1;
      const fill = () => { while (next < ctx.currentTime + 3) { kick(next); next += 0.5; } };
      fill();
      setInterval(fill, 250);
    </script></body>`,
  }),
);
// Headless: the share is a stream made in the page (see above).
if (!HEADED) {
  await context.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const tone = ctx.createOscillator(); const tg = ctx.createGain(); tg.gain.value = 0.05;
      tone.frequency.value = 440; tone.connect(tg).connect(dest); tone.start();
      const kick = (at) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.2);
        g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
        o.connect(g).connect(dest); o.start(at); o.stop(at + 0.3);
      };
      let next = ctx.currentTime + 0.1;
      setInterval(() => { while (next < ctx.currentTime + 1) { kick(next); next += 0.5; } }, 100);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 16;
      canvas.getContext('2d').fillRect(0, 0, 16, 16);
      return new MediaStream([...dest.stream.getAudioTracks(), ...canvas.captureStream(1).getVideoTracks()]);
    };
  });
}

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

  await path('LISTEN, then STOP: the test tab is shared, the bar offers the title bridge, STOP ends it and the scene goes idle', async () => {
    await page.bringToFront();
    await page.getByRole('button', { name: 'LISTEN' }).click();
    await page.getByRole('button', { name: 'STOP' }).waitFor({ timeout: 10000 });
    // No title bridge here: the bar offers it, its panel opens, the zip is there, Esc closes it.
    await page.getByRole('button', { name: 'GET TITLE BRIDGE' }).click();
    await page.getByRole('dialog', { name: 'TITLE BRIDGE' }).waitFor();
    const zip = await page.getByRole('link', { name: 'DOWNLOAD ZIP' }).getAttribute('href');
    const res = await page.request.get(new globalThis.URL(zip, PAGE).href);
    if (!res.ok() || (await res.body()).length < 1000) throw new Error(`zip: ${res.status()}`);
    await page.screenshot({ path: join(shots, '02-bridge-panel.png') });
    // axe with the panel open (axe was loaded by the axe path).
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }));
    if (r.violations.length) throw new Error(`axe, panel open: ${r.violations.map((v) => `${v.id}: ${v.nodes.length}`).join(', ')}`);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'STOP' }).click();
    await page.getByRole('button', { name: 'LISTEN' }).waitFor();
    await until((s) => s.idle > 0.9, 6000, 'idle after STOP');
  });

  await path('LISTEN again: the signal wakes, kicks are beats, bass over treble; closing the shared tab ends the share', async () => {
    await page.bringToFront();
    await page.getByRole('button', { name: 'LISTEN' }).click();
    await page.getByRole('button', { name: 'STOP' }).waitFor({ timeout: 10000 });
    const woke = await until((s) => s.idle < 0.2, 8000, 'wake');
    const before = woke.beatCount;
    // Record, in the page, when each beat is seen (epoch ms), and how often its frames run.
    await page.evaluate(() => {
      window.__beats = [];
      window.__frames = 0;
      let last = -1;
      const loop = () => {
        window.__frames++;
        const c = window.__cymaticSignal.latest()[64 * 3 + 6];
        if (last >= 0 && c !== last) window.__beats.push(performance.timeOrigin + performance.now());
        last = c;
        requestAnimationFrame(loop);
      };
      loop();
    });
    await page.waitForTimeout(4000);
    const s = await scalars();
    // The beat latency: each beat seen, against the latest kick that reached the speakers before it.
    const beatsSeen = await page.evaluate(() => window.__beats);
    const kickTimes = await tones[0].evaluate(() => window.kickTimes()).catch(() => []);
    const kickTimes2 = await tones[1].evaluate(() => window.kickTimes()).catch(() => []);
    const lags = beatsSeen
      .map((b) => Math.min(...[kickTimes, kickTimes2].map((ks) => b - (ks.filter((k) => k <= b).pop() ?? -Infinity))))
      .filter((x) => x >= 0 && x < 400)
      .sort((a, b) => a - b);
    const loopFps = (await page.evaluate(() => window.__frames)) / 4;
    if (HEADED) console.log(`    beat latency (kick at the speakers → beat seen): median ${lags[Math.floor(lags.length / 2)]?.toFixed(0)} ms, range ${lags[0]?.toFixed(0)}–${lags[lags.length - 1]?.toFixed(0)} ms over ${lags.length} beats; page loop ${loopFps.toFixed(0)} fps`);
    // 4 s at 120 BPM is 8 kicks; allow a missed one or two at the edges.
    if (s.beatCount - before < 6) throw new Error(`beats: ${s.beatCount - before} in 4 s`);
    if (s.bass <= s.treble) throw new Error(`bass ${s.bass} ≤ treble ${s.treble}`);
    await page.screenshot({ path: join(shots, '03-listening.png') });
    if (HEADED) {
      for (const t of tones) await t.close();
      // Closing the shared tab ends the share: back to LISTEN, easing into idle (R7).
      await page.getByRole('button', { name: 'LISTEN' }).waitFor({ timeout: 5000 });
    } else {
      console.log('    (headless: the share is made in the page, so closing a tab can’t end it; STOP instead)');
      await page.getByRole('button', { name: 'STOP' }).click();
    }
    await until((s) => s.idle > 0.9, 6000, 'idle after the share ended');
  });

  await path('D: the signal meter opens and closes', async () => {
    await page.keyboard.press('d');
    await page.getByRole('complementary', { name: 'Signal meter' }).waitFor();
    await page.waitForTimeout(1200);
    const text = await page.locator('.meter-figures').textContent();
    if (!/FPS/.test(text ?? '')) throw new Error(`figures: ${text}`);
    await page.screenshot({ path: join(shots, '04-meter.png') });
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

  await path('SETTINGS: palette, glow, steppers, kept across a reload, reset, export / import, diagnostics, axe', async () => {
    // axe again: the H path reloaded the page.
    await page.addScriptTag({ content: readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8') });
    await page.getByRole('button', { name: 'SETTINGS' }).click();
    const panel = page.getByRole('dialog', { name: 'SETTINGS' });
    await panel.waitFor();
    // A palette recolours the picture and the bar.
    const before = await stage('pixels');
    await panel.getByRole('button', { name: 'LASER' }).click();
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => document.documentElement.dataset.palette)) !== 'laser') throw new Error('the bar kept its palette');
    const after = await stage('pixels');
    if (after.sig === before.sig) throw new Error('the picture didn’t change');
    await panel.getByRole('button', { name: 'MAX' }).click();
    await panel.getByRole('button', { name: 'SENSITIVITY: more' }).click();
    await panel.getByRole('button', { name: 'ZOOM: less' }).click();
    await panel.getByRole('button', { name: 'TRAILS: more' }).click();
    await page.screenshot({ path: join(shots, '05-settings.png') });
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }));
    if (r.violations.length) throw new Error(`axe, settings open: ${r.violations.map((v) => `${v.id}: ${v.nodes.length}`).join(', ')}`);
    // The showing scene's own settings (PLEXUS: trails off by default, 0.25 with one "more").
    const id = await stage('scene');
    const own = () => page.evaluate((sid) => window.__cymatic.settings().scenes[sid], id);
    const want = { palette: 'laser', glow: 'max', sensitivity: 1.25, trails: 0.25, zoom: 0.9 };
    const got = await own();
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`settings: ${JSON.stringify(got)}`);
    // Kept across a reload.
    await page.evaluate(() => window.__cymatic.flush());
    await page.reload();
    await page.waitForSelector('#scene-canvas[data-ready]');
    await page.waitForTimeout(300);
    if (JSON.stringify(await own()) !== JSON.stringify(want)) throw new Error('lost on reload');
    if ((await page.evaluate(() => document.documentElement.dataset.palette)) !== 'laser') throw new Error('palette lost on reload');
    // EXPORT, RESET, then IMPORT the file back.
    await page.getByRole('button', { name: 'SETTINGS' }).click();
    await panel.getByText('BACKUP').click();
    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'EXPORT' }).click()]);
    const saved = join(shots, 'exported-settings.json');
    await download.saveAs(saved);
    if (!/^cymatic-bridge-settings-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename())) throw new Error(`file name ${download.suggestedFilename()}`);
    await panel.getByRole('button', { name: 'RESET SCENE' }).click();
    if (await own()) throw new Error('RESET kept the scene’s settings');
    await panel.locator('input[type=file]').setInputFiles(saved);
    await page.getByRole('status').filter({ hasText: 'SETTINGS IMPORTED' }).waitFor();
    if (JSON.stringify(await own()) !== JSON.stringify(want)) throw new Error('import didn’t restore');
    // A file that isn't ours is refused.
    await panel.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
    await page.getByRole('status').filter({ hasText: 'COULDN’T IMPORT' }).waitFor();
    // COPY DIAGNOSTICS.
    await panel.getByText('DIAGNOSTICS', { exact: true }).click();
    await panel.getByRole('button', { name: 'COPY DIAGNOSTICS' }).click();
    await page.getByRole('status').filter({ hasText: 'DIAGNOSTICS COPIED' }).waitFor();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (!/^cymatic_bridge \d+\.\d+\.\d+ \(build \d+\)/.test(clip) || !/fps/.test(clip)) throw new Error(`clipboard: ${clip.slice(0, 80)}`);
    // Esc closes; back to the default look for the paths after.
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'SETTINGS' }).click();
    await panel.getByRole('button', { name: 'RESET SCENE' }).click();
    await page.keyboard.press('Escape');
  });

  await path('PLEXUS: opens first, draws, crossfades to TEST and back (← / →), survives a resize', async () => {
    if ((await stage('scene')) !== 'plexus') throw new Error(`first scene: ${await stage('scene')}`);
    const px = await stage('pixels');
    if (px.lit < 0.003) throw new Error(`PLEXUS drew nothing: ${JSON.stringify(px)}`);
    await page.screenshot({ path: join(shots, '06-plexus.png') });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    // Mid-crossfade: both draw, nothing breaks.
    if ((await stage('scene')) !== 'test') throw new Error('→ didn’t reach TEST');
    await page.waitForTimeout(700);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(900);
    if ((await stage('scene')) !== 'plexus') throw new Error('← didn’t come back');
    // A new shape builds a new field.
    await page.setViewportSize({ width: 1000, height: 1000 });
    await page.waitForTimeout(800);
    if ((await stage('pixels')).lit < 0.003) throw new Error('blank after a resize');
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(500);
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
