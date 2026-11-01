/**
 * scripts/zip.ts: a minimal zip writer, used by vite.config.ts to pack the
 * title bridge extension (bridge/) as cymatic-bridge.zip next to the page.
 * cyberdeck_terminal's, unchanged.
 *
 * Layer: build tooling (Node). A zip is, per file: a local header, the
 * deflated data; then a central directory listing every file again; then
 * an end record pointing at the directory. Node has deflate and CRC-32
 * built in, so no dependency is needed for this. Timestamps are fixed
 * (1980-01-01), so the same files always give the same zip.
 */
import { crc32, deflateRawSync } from 'node:zlib';

/** One file to pack: its path inside the zip (forward slashes) and its bytes. */
export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** DOS date for 1980-01-01 (day 1, month 1, year 0), and time 00:00. */
const DOS_DATE = (1 << 5) | 1;
const DOS_TIME = 0;

/** Packs `entries` into a zip file's bytes (deflate, or stored when deflating doesn't help). */
export function makeZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);

    // Local file header (30 bytes + name).
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed: 2.0
    local.writeUInt16LE(0x0800, 6); // flags: names are UTF-8
    local.writeUInt16LE(stored ? 0 : 8, 8); // method: stored / deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    locals.push(local, nameBytes, body);

    // Its central directory entry (46 bytes + name).
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by: 2.0
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    // Extra, comment, disk, internal attributes, external attributes: all 0.
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  // End of central directory record (22 bytes).
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
