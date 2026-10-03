// Decodes a Figma .fig file (ZIP containing a "fig-kiwi" binary) into a node tree.
// The binary is: "fig-kiwi" magic, uint32 version, then length-prefixed chunks:
//   chunk 0 = kiwi schema (deflate-raw), chunk 1 = document message (zstd or deflate-raw).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { inflateRawSync } from 'node:zlib';
import kiwi from 'kiwi-schema';

function readZipEntry(buf, wanted) {
  // Find the entry through the central directory so sizes are always present.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip archive');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), cmtLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
      const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return null;
}

function decompress(b) {
  const isZstd = b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
  if (isZstd) {
    if (!zlib.zstdDecompressSync) throw new Error('This .fig uses zstd; run with Node >= 22.15');
    return zlib.zstdDecompressSync(b);
  }
  return inflateRawSync(b);
}

export const key = (g) => `${g.sessionID}:${g.localID}`;

export function loadFig(file) {
  const raw = fs.readFileSync(file);
  const canvas = raw.subarray(0, 8).toString() === 'fig-kiwi' ? raw : readZipEntry(raw, 'canvas.fig');
  if (!canvas) throw new Error('canvas.fig not found in ' + file);
  const chunks = [];
  for (let off = 12; off < canvas.length;) {
    const n = canvas.readUInt32LE(off);
    chunks.push(canvas.subarray(off + 4, off + 4 + n));
    off += 4 + n;
  }
  const schema = kiwi.compileSchema(kiwi.decodeBinarySchema(decompress(chunks[0])));
  const message = schema.decodeMessage(decompress(chunks[1]));

  const nodes = new Map();
  for (const n of message.nodeChanges) {
    n._id = key(n.guid);
    n._kids = [];
    nodes.set(n._id, n);
  }
  for (const n of message.nodeChanges) {
    const parent = n.parentIndex && nodes.get(key(n.parentIndex.guid));
    if (!parent) continue;
    n._pos = n.parentIndex.position;
    n._parent = parent;
    parent._kids.push(n);
  }
  for (const n of nodes.values()) n._kids.sort((a, b) => (a._pos < b._pos ? -1 : a._pos > b._pos ? 1 : 0));

  return {
    nodes,
    blobs: message.blobs.map((b) => Buffer.from(b.bytes)),
    images: (hash) => readZipEntry(raw, `images/${hash}`),
  };
}
