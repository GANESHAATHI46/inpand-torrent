/**
 * Standards-compliant pure TypeScript BitTorrent Bencode & .torrent Parser.
 *
 * Implements BEP 3 (The BitTorrent Protocol Specification):
 * - Parses bencoded integers, byte strings, lists, and dictionaries.
 * - Extracts the exact raw byte range of the 'info' dictionary from the input buffer.
 * - Computes the canonical 40-character hexadecimal SHA-1 info-hash from the exact
 *   original bencoded info slice (never re-encoding).
 * - Extracts single-file and multi-file tree layouts, piece lengths, and tracker tiers.
 */

export interface ParsedTorrentFile {
  index: number;
  path: string;
  size: number;
  offset: number;
  priority: number;
  downloadedBytes: number;
  progress: number;
}

export interface ParsedTorrentMetadata {
  infoHash: string;
  name: string;
  totalSize: number;
  pieceLength: number;
  numPieces: number;
  files: ParsedTorrentFile[];
  trackers: string[];
  comment?: string;
  createdBy?: string;
  creationDate?: number;
  isPrivate?: boolean;
}

export class TorrentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TorrentParseError';
  }
}

/**
 * Pure JavaScript SHA-1 implementation (FIPS 180-1 / RFC 3174 compliant).
 * Runs synchronously across Hermes, JavaScriptCore, V8, and Web environments.
 */
export function sha1(bytes: Uint8Array): string {
  // Pre-processing: padding
  const msgLength = bytes.length;
  const bitLength = msgLength * 8;
  const withOne = msgLength + 1;
  const padLength = (withOne % 64 <= 56 ? 56 - (withOne % 64) : 120 - (withOne % 64));
  const totalLength = withOne + padLength + 8;

  const padded = new Uint8Array(totalLength);
  padded.set(bytes, 0);
  padded[msgLength] = 0x80;

  // 64-bit big-endian representation of length in bits
  const view = new DataView(padded.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(totalLength - 4, bitLength >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 80; t++) {
      const v = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16];
      w[t] = (v << 1) | (v >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const hex = [h0, h1, h2, h3, h4]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('')
    .toLowerCase();
  return hex;
}

/**
 * Base64 string to Uint8Array converter.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64.trim().replace(/\s/g, ''));
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parses bencoded torrent buffer into complete metadata and computes exact info-hash.
 */
export function parseTorrentBuffer(data: Uint8Array): ParsedTorrentMetadata {
  if (!data || data.length < 20) {
    throw new TorrentParseError('Invalid torrent file: buffer is empty or smaller than 20 bytes.');
  }

  if (data.length > 50 * 1024 * 1024) {
    throw new TorrentParseError('Invalid torrent file: size exceeds 50MB ceiling.');
  }

  if (data[0] !== 0x64 /* 'd' */) {
    throw new TorrentParseError('Invalid torrent file: root element is not a bencoded dictionary.');
  }

  const ctx = {
    infoRawSlice: null as Uint8Array | null,
  };
  const decoder = new TextDecoder('utf-8', { fatal: false });

  function decodeNext(idx: number): [any, number] {
    if (idx >= data.length) {
      throw new TorrentParseError(`Unexpected end of bencoded stream at byte ${idx}`);
    }

    const charCode = data[idx];

    // Integer: i<digits>e
    if (charCode === 0x69 /* 'i' */) {
      let end = idx + 1;
      while (end < data.length && data[end] !== 0x65 /* 'e' */) {
        end++;
      }
      if (end >= data.length) {
        throw new TorrentParseError(`Unterminated integer at byte ${idx}`);
      }
      const numStr = decoder.decode(data.subarray(idx + 1, end));
      const val = parseInt(numStr, 10);
      if (isNaN(val)) {
        throw new TorrentParseError(`Invalid integer '${numStr}' at byte ${idx}`);
      }
      return [val, end + 1];
    }

    // List: l<contents>e
    if (charCode === 0x6c /* 'l' */) {
      const list: any[] = [];
      let curr = idx + 1;
      while (curr < data.length && data[curr] !== 0x65 /* 'e' */) {
        const [item, next] = decodeNext(curr);
        list.push(item);
        curr = next;
      }
      if (curr >= data.length) {
        throw new TorrentParseError(`Unterminated list starting at byte ${idx}`);
      }
      return [list, curr + 1];
    }

    // Dictionary: d<contents>e
    if (charCode === 0x64 /* 'd' */) {
      const dict: Record<string, any> = {};
      let curr = idx + 1;
      while (curr < data.length && data[curr] !== 0x65 /* 'e' */) {
        const [keyVal, afterKey] = decodeNext(curr);
        const key = typeof keyVal === 'string' ? keyVal : decoder.decode(keyVal);

        const valStart = afterKey;
        const [val, afterVal] = decodeNext(afterKey);
        const valEnd = afterVal;

        // If this is the root 'info' dictionary, capture the exact raw byte range!
        if (idx === 0 && key === 'info') {
          ctx.infoRawSlice = data.subarray(valStart, valEnd);
        }

        dict[key] = val;
        curr = afterVal;
      }
      if (curr >= data.length) {
        throw new TorrentParseError(`Unterminated dictionary starting at byte ${idx}`);
      }
      return [dict, curr + 1];
    }

    // Byte string: <length>:<bytes>
    if (charCode >= 0x30 && charCode <= 0x39 /* '0'..'9' */) {
      let colon = idx;
      while (colon < data.length && data[colon] !== 0x3a /* ':' */) {
        colon++;
      }
      if (colon >= data.length) {
        throw new TorrentParseError(`Missing colon in byte string length at byte ${idx}`);
      }
      const lenStr = decoder.decode(data.subarray(idx, colon));
      const strLen = parseInt(lenStr, 10);
      if (isNaN(strLen) || strLen < 0) {
        throw new TorrentParseError(`Invalid byte string length '${lenStr}' at byte ${idx}`);
      }

      const strStart = colon + 1;
      const strEnd = strStart + strLen;
      if (strEnd > data.length) {
        throw new TorrentParseError(`Byte string length ${strLen} exceeds stream length at byte ${idx}`);
      }

      const raw = data.subarray(strStart, strEnd);
      return [raw, strEnd];
    }

    throw new TorrentParseError(`Invalid bencode token byte 0x${charCode.toString(16)} at index ${idx}`);
  }

  const [root] = decodeNext(0);

  if (!root || typeof root !== 'object') {
    throw new TorrentParseError('Root element must be a bencoded dictionary.');
  }

  const info = root.info;
  if (!info || typeof info !== 'object') {
    throw new TorrentParseError("Missing or invalid 'info' dictionary in torrent file.");
  }

  const rawInfo = ctx.infoRawSlice;
  if (!rawInfo || rawInfo.length === 0) {
    throw new TorrentParseError("Failed to extract raw 'info' dictionary byte slice.");
  }

  // Calculate canonical info-hash from the exact raw info slice
  const infoHash = sha1(rawInfo);

  // Helper to decode string from raw Uint8Array or string
  const toStr = (val: any, fallback = ''): string => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (val instanceof Uint8Array) return decoder.decode(val);
    return String(val);
  };

  const name = toStr(info.name, `Torrent_${infoHash.slice(0, 8)}`);

  const pieceLength = typeof info['piece length'] === 'number' ? info['piece length'] : 0;
  if (pieceLength <= 0) {
    throw new TorrentParseError("Torrent 'piece length' must be a positive integer.");
  }

  const piecesRaw = info.pieces;
  if (!(piecesRaw instanceof Uint8Array) || piecesRaw.length % 20 !== 0) {
    throw new TorrentParseError("Torrent 'pieces' block must be a multiple of 20 bytes.");
  }
  const numPieces = piecesRaw.length / 20;

  // Trackers extraction
  const trackers: string[] = [];
  const seenTrackers = new Set<string>();

  const addTracker = (url: string) => {
    const clean = url.trim();
    if (clean && !seenTrackers.has(clean)) {
      seenTrackers.add(clean);
      trackers.push(clean);
    }
  };

  if (root.announce) {
    addTracker(toStr(root.announce));
  }

  if (Array.isArray(root['announce-list'])) {
    for (const tier of root['announce-list']) {
      if (Array.isArray(tier)) {
        for (const tr of tier) {
          addTracker(toStr(tr));
        }
      }
    }
  }

  // Files extraction
  const files: ParsedTorrentFile[] = [];
  let totalSize = 0;

  if (Array.isArray(info.files)) {
    // Multi-file layout
    let currOffset = 0;
    info.files.forEach((fileItem: any, idx: number) => {
      const length = typeof fileItem.length === 'number' ? fileItem.length : 0;
      let pathSegments: string[] = [];
      if (Array.isArray(fileItem.path)) {
        pathSegments = fileItem.path.map((seg: any) => toStr(seg));
      }
      const relPath = pathSegments.join('/') || `file_${idx}`;
      const fullPath = `${name}/${relPath}`;

      files.push({
        index: idx,
        path: fullPath,
        size: length,
        offset: currOffset,
        priority: 4, // Normal
        downloadedBytes: 0,
        progress: 0,
      });

      currOffset += length;
      totalSize += length;
    });
  } else {
    // Single file layout
    const length = typeof info.length === 'number' ? info.length : 0;
    totalSize = length;
    files.push({
      index: 0,
      path: name,
      size: length,
      offset: 0,
      priority: 4,
      downloadedBytes: 0,
      progress: 0,
    });
  }

  return {
    infoHash,
    name,
    totalSize,
    pieceLength,
    numPieces,
    files,
    trackers,
    comment: root.comment ? toStr(root.comment) : undefined,
    createdBy: root['created by'] ? toStr(root['created by']) : undefined,
    creationDate: typeof root['creation date'] === 'number' ? root['creation date'] : undefined,
    isPrivate: info.private === 1,
  };
}

/**
 * Parses a base64-encoded .torrent file into complete metadata.
 */
export function parseTorrentBase64(base64: string): ParsedTorrentMetadata {
  const bytes = base64ToUint8Array(base64);
  return parseTorrentBuffer(bytes);
}
