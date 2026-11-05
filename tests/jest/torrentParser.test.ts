import {
  parseTorrentBuffer,
  parseTorrentBase64,
  TorrentParseError,
  sha1,
} from '../../src/utils/torrentParser';

// Helper to construct sample bencoded torrent buffers
function createMockTorrentBytes(opts: {
  name: string;
  pieceLength: number;
  pieces: Uint8Array;
  length?: number;
  files?: Array<{ length: number; path: string[] }>;
  announce?: string;
  announceList?: string[][];
}): Uint8Array {
  // Construct bencoded info dict
  let info = 'd';
  if (opts.files) {
    info += '5:filesl';
    for (const f of opts.files) {
      info += `d6:lengthi${f.length}e4:pathl`;
      for (const p of f.path) {
        info += `${p.length}:${p}`;
      }
      info += 'ee';
    }
    info += 'e';
  } else {
    info += `6:lengthi${opts.length || 1024}e`;
  }
  info += `4:name${opts.name.length}:${opts.name}`;
  info += `12:piece lengthi${opts.pieceLength}e`;
  info += `6:pieces${opts.pieces.length}:`;

  const infoPrefixBytes = new TextEncoder().encode(info);
  const infoSuffixBytes = new TextEncoder().encode('e');

  const infoTotal = new Uint8Array(infoPrefixBytes.length + opts.pieces.length + infoSuffixBytes.length);
  infoTotal.set(infoPrefixBytes, 0);
  infoTotal.set(opts.pieces, infoPrefixBytes.length);
  infoTotal.set(infoSuffixBytes, infoPrefixBytes.length + opts.pieces.length);

  // Root dictionary
  let rootPrefix = 'd';
  if (opts.announce) {
    rootPrefix += `8:announce${opts.announce.length}:${opts.announce}`;
  }
  if (opts.announceList) {
    rootPrefix += '13:announce-listl';
    for (const tier of opts.announceList) {
      rootPrefix += 'l';
      for (const tr of tier) {
        rootPrefix += `${tr.length}:${tr}`;
      }
      rootPrefix += 'e';
    }
    rootPrefix += 'e';
  }
  rootPrefix += '4:info';

  const rootPrefixBytes = new TextEncoder().encode(rootPrefix);
  const rootSuffixBytes = new TextEncoder().encode('e');

  const total = new Uint8Array(rootPrefixBytes.length + infoTotal.length + rootSuffixBytes.length);
  total.set(rootPrefixBytes, 0);
  total.set(infoTotal, rootPrefixBytes.length);
  total.set(rootSuffixBytes, rootPrefixBytes.length + infoTotal.length);

  return total;
}

describe('TorrentParser Unit Tests', () => {
  const fakePieces = new Uint8Array(40); // 2 pieces (20 bytes each)
  fakePieces.fill(0xaa, 0, 20);
  fakePieces.fill(0xbb, 20, 40);

  test('correctly parses single-file .torrent and calculates info-hash from exact raw slice', () => {
    const raw = createMockTorrentBytes({
      name: 'ubuntu-24.04-desktop.iso',
      pieceLength: 262144,
      pieces: fakePieces,
      length: 5000000000,
      announce: 'http://torrent.ubuntu.com/announce',
      announceList: [['http://torrent.ubuntu.com/announce'], ['udp://tracker.opentrackr.org:1337/announce']],
    });

    const parsed = parseTorrentBuffer(raw);
    expect(parsed.name).toBe('ubuntu-24.04-desktop.iso');
    expect(parsed.totalSize).toBe(5000000000);
    expect(parsed.pieceLength).toBe(262144);
    expect(parsed.numPieces).toBe(2);
    expect(parsed.files.length).toBe(1);
    expect(parsed.files[0].path).toBe('ubuntu-24.04-desktop.iso');
    expect(parsed.trackers).toContain('http://torrent.ubuntu.com/announce');
    expect(parsed.trackers).toContain('udp://tracker.opentrackr.org:1337/announce');
    expect(parsed.infoHash).toMatch(/^[a-f0-9]{40}$/);
  });

  test('correctly parses multi-file .torrent tree layout', () => {
    const raw = createMockTorrentBytes({
      name: 'SampleAlbum',
      pieceLength: 65536,
      pieces: fakePieces,
      files: [
        { length: 15000000, path: ['cd1', 'track01.flac'] },
        { length: 25000000, path: ['cd1', 'track02.flac'] },
        { length: 500000, path: ['artwork', 'cover.jpg'] },
      ],
      announce: 'http://tracker.example.com/announce',
    });

    const parsed = parseTorrentBuffer(raw);
    expect(parsed.name).toBe('SampleAlbum');
    expect(parsed.totalSize).toBe(40500000);
    expect(parsed.files.length).toBe(3);
    expect(parsed.files[0].path).toBe('SampleAlbum/cd1/track01.flac');
    expect(parsed.files[0].offset).toBe(0);
    expect(parsed.files[1].path).toBe('SampleAlbum/cd1/track02.flac');
    expect(parsed.files[1].offset).toBe(15000000);
    expect(parsed.files[2].path).toBe('SampleAlbum/artwork/cover.jpg');
    expect(parsed.files[2].offset).toBe(40000000);
  });

  test('rejects empty or truncated buffer', () => {
    expect(() => parseTorrentBuffer(new Uint8Array([]))).toThrow(TorrentParseError);
    expect(() => parseTorrentBuffer(new Uint8Array([0x64, 0x65]))).toThrow(TorrentParseError);
  });

  test('rejects non-bencoded or malformed data', () => {
    const invalid = new TextEncoder().encode('<html><body>Not a torrent</body></html>');
    expect(() => parseTorrentBuffer(invalid)).toThrow(TorrentParseError);
  });

  test('rejects torrent missing info dictionary', () => {
    const noInfo = new TextEncoder().encode('d8:announce27:http://tracker.example.com/e');
    expect(() => parseTorrentBuffer(noInfo)).toThrow(TorrentParseError);
  });

  test('rejects invalid pieces block (not multiple of 20)', () => {
    const badPieces = new Uint8Array(25);
    const raw = createMockTorrentBytes({
      name: 'bad_pieces.bin',
      pieceLength: 16384,
      pieces: badPieces,
      length: 100,
    });
    expect(() => parseTorrentBuffer(raw)).toThrow(TorrentParseError);
  });

  test('sha1 function matches known test vectors', () => {
    const empty = new Uint8Array(0);
    expect(sha1(empty)).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');

    const abc = new TextEncoder().encode('abc');
    expect(sha1(abc)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});

