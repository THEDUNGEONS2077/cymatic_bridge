/**
 * src/lib/migrations.ts: brings a stored settings document of any version
 * up to the current one.
 *
 * Layer: pure lib (tested with fixtures). cyberdeck's rule, kept: a shape
 * change bumps SETTINGS_VERSION and adds a step here (from version n to
 * n + 1), with a fixture test of a real older document. Version 1 is the
 * first, so there are no steps yet.
 *
 * What it can't read is reported, not guessed at: the caller keeps it under
 * `corrupt.*` and starts from the defaults (never writes over data it
 * couldn't read).
 */
import { normalizeSettings, type Settings, SETTINGS_VERSION } from './settings';

/** One step: a version-n document to version n + 1. */
type Step = (doc: Record<string, unknown>) => Record<string, unknown>;

/** The steps, by the version they start from. None yet: version 1 is the first. */
const STEPS: Record<number, Step> = {};

/** The result: the document, or why it couldn't be read. */
export type Migrated = { ok: true; settings: Settings } | { ok: false; reason: string };

/** Reads a stored document of any version: steps it up to SETTINGS_VERSION and normalizes it. */
export function migrateSettings(raw: unknown): Migrated {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not a settings document' };
  let doc = raw as Record<string, unknown>;
  const v = doc.v;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, reason: `unknown version ${String(v)}` };
  // A newer build's document: read what this build knows (normalize keeps unknown scenes).
  if (v > SETTINGS_VERSION) return { ok: true, settings: normalizeSettings(doc) };
  for (let at = v; at < SETTINGS_VERSION; at++) {
    const step = STEPS[at];
    if (!step) return { ok: false, reason: `no step from version ${at}` };
    doc = step(doc);
  }
  return { ok: true, settings: normalizeSettings(doc) };
}
