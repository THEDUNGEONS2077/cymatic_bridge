// e2e/bridge.mjs: the title bridge, loaded as shipped (`npm run e2e:bridge`, after `npm run build`).
//
// Chromium with the real unpacked extension (bridge/), the built page served
// on 127.0.0.1:8175 (one of the bridge's PERMITTED origins), and a fake
// YouTube watch page at https://www.youtube.com/watch, routed (nothing goes
// to YouTube). The bridge's content script runs on it because its address
// matches. Titles don't need sound, so this runs headless (headless capture is
// silent, but the capture handle still arrives). Checks:
//   - LISTEN on the fake YouTube tab shows its title in the bar, cleaned;
//   - the next song (the title changing in place) shows at once;
//   - the bar doesn't offer the bridge (it's there).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'e2e/screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 8175;
const PAGE = `http://127.0.0.1:${PORT}/`;
const YT = 'https://www.youtube.com/watch?v=cymatic-test';
const YT_TITLE = '(2) Night Drive Mix 2026 - YouTube';

const server = spawn(join(root, 'node_modules/.bin/serve'), [join(root, 'dist'), '-l', `tcp://127.0.0.1:${PORT}`, '--no-port-switching'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try {
    await fetch(PAGE);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Extensions need a persistent profile: a fresh temporary one each run.
const profile = mkdtempSync(join(tmpdir(), 'cymatic-bridge-e2e-'));
const ext = join(root, 'bridge');
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--auto-select-tab-capture-source-by-title=${YT_TITLE}`],
});
// The fake YouTube watch page (routed: nothing reaches YouTube).
await context.route('https://www.youtube.com/**', (route) =>
  route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><title>${YT_TITLE}</title></head><body style="background:#000">fake watch page</body></html>` }),
);
let failed = 0;
const errors = [];

/** One check: runs the steps, then fails on any page error. */
async function path(name, page, fn) {
  try {
    await fn();
    if (errors.length) throw new Error(`page error: ${errors.splice(0).join(' | ')}`);
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✕ ${name}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(shots, `FAILED-bridge-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 50)}.png`) }).catch(() => {});
  }
}

try {
  // The YouTube tab first (the picker only picks tabs opened before the page: PLAYBOOK § 2.1).
  const yt = await context.newPage();
  await yt.goto(YT);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.waitForSelector('.topbar');

  await path('LISTEN: the shared YouTube tab’s title shows in the bar, cleaned', page, async () => {
    await page.getByRole('button', { name: 'LISTEN' }).click();
    await page.getByRole('button', { name: 'STOP' }).waitFor({ timeout: 10000 });
    await page.locator('.title', { hasText: 'Night Drive Mix 2026' }).waitFor({ timeout: 5000 });
    const text = await page.locator('.title').textContent();
    if (text !== 'Night Drive Mix 2026') throw new Error(`title: "${text}"`);
    if (await page.getByRole('button', { name: 'GET TITLE BRIDGE' }).count()) throw new Error('offered the bridge though it’s there');
    await page.screenshot({ path: join(shots, 'bridge-01-title.png') });
  });

  await path('the next song: a title changed in place shows at once', page, async () => {
    await yt.evaluate(() => (document.title = 'Midnight City - YouTube'));
    await page.locator('.title', { hasText: 'Midnight City' }).waitFor({ timeout: 3000 });
  });

  await path('YouTube’s home page (no video): no title, and no offer', page, async () => {
    await yt.evaluate(() => (document.title = 'YouTube'));
    await page.waitForFunction(() => document.querySelector('.title')?.textContent === '', null, { timeout: 3000 });
    if (await page.getByRole('button', { name: 'GET TITLE BRIDGE' }).count()) throw new Error('offered the bridge though it’s there');
  });

  await path('STOP: the title goes', page, async () => {
    await page.getByRole('button', { name: 'STOP' }).click();
    await page.getByRole('button', { name: 'LISTEN' }).waitFor();
    if ((await page.locator('.title').textContent()) !== '') throw new Error('title stayed');
  });
} finally {
  await context.close();
  server.kill();
  rmSync(profile, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} path(s) failed` : '\nall paths passed');
process.exit(failed ? 1 : 0);
