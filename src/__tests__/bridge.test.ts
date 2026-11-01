/**
 * src/__tests__/bridge.test.ts: the title bridge's label, and the bridge
 * files kept in step with the page.
 *
 * Layer: tests (Node). The extension (bridge/) is plain files loaded
 * unpacked, so its version is written in two places there and one here:
 * this test keeps all three the same, and keeps the page's origins in the
 * list of who may read the label.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BRIDGE_VERSION, cleanTitle, isOlder, parseHandle } from '@/lib/bridge';

const bridgeFile = (name: string) => readFileSync(new URL(`../../bridge/${name}`, import.meta.url), 'utf8');

describe('the title', () => {
  it('drops YouTube’s suffix and notification count', () => {
    expect(cleanTitle('(3) Night Drive Mix 2026 - YouTube')).toBe('Night Drive Mix 2026');
    expect(cleanTitle('Midnight City - YouTube Music')).toBe('Midnight City');
    expect(cleanTitle('(99+) A  -  B - YouTube')).toBe('A - B');
    expect(cleanTitle('Song - Artist – YouTube')).toBe('Song - Artist');
  });

  it('is empty when the tab shows no video', () => {
    expect(cleanTitle('YouTube')).toBe('');
    expect(cleanTitle('(2) YouTube')).toBe('');
    expect(cleanTitle('YouTube Music')).toBe('');
  });
});

describe('the label', () => {
  it('reads the bridge’s label, and nothing else', () => {
    expect(parseHandle(JSON.stringify({ app: 'cymatic_bridge', v: '1.0.0', title: 'Song - YouTube' }))).toEqual({ v: '1.0.0', title: 'Song' });
    for (const h of [null, '', 'not json', '{}', JSON.stringify({ app: 'other', v: '1', title: 'x' }), JSON.stringify({ app: 'cymatic_bridge', title: 'x' })]) {
      expect(parseHandle(h)).toBeNull();
    }
  });

  it('compares versions', () => {
    expect(isOlder('1.0.0', '1.0.1')).toBe(true);
    expect(isOlder('1.2', '1.10')).toBe(true);
    expect(isOlder('1.0.0', '1.0.0')).toBe(false);
    expect(isOlder('2.0.0', '1.9.9')).toBe(false);
  });
});

describe('the bridge files', () => {
  it('say the same version as the page', () => {
    expect(JSON.parse(bridgeFile('manifest.json')).version).toBe(BRIDGE_VERSION);
    expect(bridgeFile('title.js')).toContain(`const VERSION = '${BRIDGE_VERSION}';`);
  });

  it('ask for no permissions, and run only on YouTube and YouTube Music', () => {
    const m = JSON.parse(bridgeFile('manifest.json'));
    expect(m.permissions).toBeUndefined();
    expect(m.host_permissions).toBeUndefined();
    expect(m.content_scripts[0].matches).toEqual(['https://www.youtube.com/*', 'https://music.youtube.com/*']);
  });

  it('let the published page, the dev server and the tests read the label', () => {
    const js = bridgeFile('title.js');
    for (const origin of ['https://thedungeons2077.github.io', 'http://127.0.0.1:5173', 'http://127.0.0.1:8173', 'http://127.0.0.1:8175']) expect(js).toContain(`'${origin}'`);
  });
});
