import * as SQLite from 'expo-sqlite';
import { DatabaseService } from '../../src/services/DatabaseService';
import { TorrentItem, SessionSettings } from '../../src/types/torrent';

// Mock expo-sqlite
const mockExecAsync = jest.fn().mockResolvedValue(undefined);
const mockRunAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockWithTransactionAsync = jest.fn().mockImplementation(async (callback: () => Promise<any>) => {
  return await callback();
});
const mockCloseAsync = jest.fn().mockResolvedValue(undefined);

const fakeDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  withTransactionAsync: mockWithTransactionAsync,
  closeAsync: mockCloseAsync,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => fakeDb),
}));

describe('DatabaseService Lifecycle and Operation Tests', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    dbService = DatabaseService.getInstance();
    // Reset internal state for test isolation
    await dbService.closeDatabase();
  });

  it('guarantees singleton instance', () => {
    const inst1 = DatabaseService.getInstance();
    const inst2 = DatabaseService.getInstance();
    expect(inst1).toBe(inst2);
  });

  it('initializes schema atomically only once on concurrent getDb() calls', async () => {
    // Fire multiple concurrent getDb() calls
    const [db1, db2, db3] = await Promise.all([
      dbService.getDb(),
      dbService.getDb(),
      dbService.getDb(),
    ]);

    expect(db1).toBe(fakeDb);
    expect(db2).toBe(fakeDb);
    expect(db3).toBe(fakeDb);

    // openDatabaseSync should have been called only once
    expect(SQLite.openDatabaseSync).toHaveBeenCalledTimes(1);
    // Schema creation should have been executed
    expect(mockExecAsync).toHaveBeenCalledTimes(1);
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS torrents'));
  });

  it('atomically inserts torrent with trackers as strings and files array', async () => {
    mockGetFirstAsync
      .mockResolvedValueOnce(null) // Not existing
      .mockResolvedValueOnce({ next_pos: 1 }); // Next queue position

    const torrentData: Partial<TorrentItem> = {
      infoHash: 'B1C2D3E4F5A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3',
      name: 'Sample Movie (2026)',
      totalSize: 2147483648,
      downloadedBytes: 0,
      uploadedBytes: 0,
      status: 'downloading',
      savePath: '/storage/emulated/0/Download/InpandTorrent',
      pieceLength: 1048576,
      numPieces: 2048,
      files: [
        {
          index: 0,
          path: 'Sample Movie (2026)/movie.mkv',
          size: 2147483648,
          offset: 0,
          downloadedBytes: 0,
          priority: 4,
          progress: 0,
        },
      ],
      // Trackers as string array (as returned by TorrentEngineModule.kt)
      trackers: [
        'udp://tracker.opentrackr.org:1337/announce',
        'http://tracker.torrent.org/announce',
      ] as any,
    };

    await dbService.insertTorrent(torrentData);

    // Must be wrapped in transaction
    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);

    // Must check for existing torrent
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM torrents WHERE info_hash = ?'),
      ['b1c2d3e4f5a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3']
    );

    // Must insert torrent record with sanitized values (no undefined)
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO torrents'),
      expect.arrayContaining([
        'b1c2d3e4f5a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        'Sample Movie (2026)',
        2147483648,
      ])
    );

    // Verify all params passed to runAsync have zero undefined values
    for (const call of mockRunAsync.mock.calls) {
      const params = call[1];
      if (Array.isArray(params)) {
        for (const p of params) {
          expect(p).not.toBeUndefined();
        }
      }
    }

    // Verify tracker queries inserted valid URLs (not undefined)
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO trackers'),
      ['b1c2d3e4f5a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'udp://tracker.opentrackr.org:1337/announce', 0]
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO trackers'),
      ['b1c2d3e4f5a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'http://tracker.torrent.org/announce', 1]
    );
  });

  it('rejects inserting duplicate torrents', async () => {
    mockGetFirstAsync.mockResolvedValueOnce({ 1: 1 }); // Torrent already exists

    await expect(
      dbService.insertTorrent({ infoHash: 'c0ffee1234567890c0ffee1234567890c0ffee12' })
    ).rejects.toThrow('already exists');
  });

  it('rejects inserting torrent without infoHash', async () => {
    await expect(
      dbService.insertTorrent({ name: 'Invalid Torrent' })
    ).rejects.toThrow('valid infoHash');
  });

  it('saves and loads settings with transactions', async () => {
    const settings: SessionSettings = {
      downloadRateLimit: 5000000,
      uploadRateLimit: 1000000,
      maxActiveDownloads: 3,
      maxActiveUploads: 2,
      maxConnections: 150,
      dhtEnabled: true,
      pexEnabled: true,
      lsdEnabled: true,
      wifiOnly: true,
      mobileDataWarning: false,
      listenPort: 6881,
      defaultSavePath: '/storage/emulated/0/Download/InpandTorrent',
      darkMode: true,
    };

    await dbService.saveSettings(settings);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO settings'),
      ['downloadRateLimit', '5000000']
    );

    mockGetAllAsync.mockResolvedValueOnce([
      { key: 'downloadRateLimit', value: '5000000' },
      { key: 'wifiOnly', value: 'true' },
    ]);

    const loaded = await dbService.loadSettings();
    expect(loaded.downloadRateLimit).toBe(5000000);
    expect(loaded.wifiOnly).toBe(true);
  });
});

