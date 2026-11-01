/**
 * src/lib/bridge.ts: reading the title bridge's label.
 *
 * Layer: pure lib (tested). The title bridge (bridge/title.js) labels a
 * YouTube or YouTube Music tab with its title through Chrome's capture
 * handle; the page reads that from the shared tab's video track
 * (audio/listen.ts). Here: checking the label, cleaning the title for the
 * bar (R9: the video title only), and telling whether the bridge is older
 * than this page expects (R10: the page offers the update).
 */

/** The bridge version this page ships (bridge/manifest.json and bridge/title.js say the same; a test checks). */
export const BRIDGE_VERSION = '1.0.0';
/** The label's app name: a handle from anything else is ignored. */
export const BRIDGE_APP = 'cymatic_bridge';

/** What a label says. */
export interface BridgeLabel {
  /** The bridge's version. */
  v: string;
  /** The tab's title, cleaned for the bar (empty when the tab shows no video). */
  title: string;
}

/** Reads a capture handle's string: the bridge's label, or null if it isn't one. */
export function parseHandle(handle: string | null | undefined): BridgeLabel | null {
  if (!handle) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(handle);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.app !== BRIDGE_APP || typeof r.v !== 'string' || typeof r.title !== 'string') return null;
  return { v: r.v.slice(0, 32), title: cleanTitle(r.title) };
}

/**
 * The title as the bar shows it: YouTube's " - YouTube" / " - YouTube
 * Music" suffix and its "(3) " notification count dropped, spaces tidied.
 * A tab on YouTube's home page or search is titled just "YouTube": that's
 * no video, so it's empty.
 */
export function cleanTitle(title: string): string {
  let t = title.replace(/\s+/g, ' ').trim();
  t = t.replace(/^\(\d+\+?\)\s*/, '');
  t = t.replace(/\s*[-–—]\s*YouTube( Music)?$/i, '');
  if (/^YouTube( Music)?$/i.test(t)) return '';
  return t.slice(0, 300);
}

/** Is version `a` older than `b`? (Dotted numbers; a missing part counts as 0.) */
export function isOlder(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
