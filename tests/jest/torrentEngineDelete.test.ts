import { Platform, NativeModules } from 'react-native';
import { TorrentEngine } from '../../src/services/TorrentEngine';
import { DatabaseService } from '../../src/services/DatabaseService';
import { TorrentItem } from '../../src/types/torrent';

jest.mock('react-native', () => {
  return {
    Platform: { OS: 'android' },
    NativeModules: {
      TorrentEngineModule: {
        removeTorrent: jest.fn().mockResolvedValue(true),
        pauseTorrent: jest.fn().mockResolvedValue(true),
        resumeTorrent: jest.fn().mockResolvedValue(true),
        initializeSession: jest.fn().mockResolvedValue(true),
        getInitialTorrent: jest.fn().mockResolvedValue(null),
      },
    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    })),
  };
});

const mockDb = {
  deleteTorrent: jest.fn().mockResolvedValue(undefined),
  loadAllTorrents: jest.fn().mockResolvedValue([]),
  insertTorrent: jest.fn().mockResolvedValue(undefined),
  updateTorrentStatus: jest.fn().mockResolvedValue(undefined),
  loadSettings: jest.fn().mockResolvedValue({
    defaultSavePath: '/storage/emulated/0/Download/TorrentFlow',
  }),
};

jest.mock('../../src/services/DatabaseService', () => {
  return {
    DatabaseService: {
      getInstance: () => mockDb,
    },
  };
});

describe('TorrentEngine Deletion Unit Tests', () => {
  let engine: TorrentEngine;
  const testHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  const { TorrentEngineModule } = NativeModules;

  beforeEach(async () => {
    jest.clearAllMocks();
    engine = TorrentEngine.getInstance();
    (engine as any).activeTorrents.clear();
    (engine as any).pendingDeletions.clear();
    (engine as any).isInitialized = false;

    // Add a fixture torrent directly to activeTorrents
    const fixtureTorrent: TorrentItem = {
      infoHash: testHash,
      name: 'Ubuntu 24.04 LTS Desktop',
      status: 'downloading',
      totalSize: 4000000000,
      downloadedBytes: 1000000000,
      uploadedBytes: 200000000,
      downloadRate: 5000000,
      uploadRate: 500000,
      progress: 0.25,
      eta: 600,
      numSeeds: 50,
      numPeers: 120,
      totalSeeds: 80,
      totalPeers: 200,
      savePath: '/storage/emulated/0/Download/TorrentFlow',
      addedDate: Date.now(),
      completedDate: null,
      pieceLength: 1048576,
      numPieces: 3814,
      files: [],
      trackers: [],
      peers: [],
    };
    (engine as any).activeTorrents.set(testHash, fixtureTorrent);
  });

  it('Mode A: removes torrent from memory and database without deleting files', async () => {
    expect(engine.getTorrent(testHash)).toBeDefined();
    expect(engine.getAllTorrents().length).toBe(1);

    await engine.removeTorrent(testHash, false);

    // Verify native module was called with deleteFiles = false
    expect(TorrentEngineModule.removeTorrent).toHaveBeenCalledTimes(1);
    expect(TorrentEngineModule.removeTorrent).toHaveBeenCalledWith(testHash, false);

    // Verify database was called with atomic cascade delete
    expect(mockDb.deleteTorrent).toHaveBeenCalledTimes(1);
    expect(mockDb.deleteTorrent).toHaveBeenCalledWith(testHash);

    // Verify memory cache was cleared
    expect(engine.getTorrent(testHash)).toBeUndefined();
    expect(engine.getAllTorrents().length).toBe(0);

    // Verify stats recalculation
    const stats = engine.getDashboardStats();
    expect(stats.totalTorrents).toBe(0);
    expect(stats.activeDownloads).toBe(0);
    expect(stats.downloadSpeed).toBe(0);
  });

  it('Mode B: removes torrent and requests native deletion of files', async () => {
    expect(engine.getTorrent(testHash)).toBeDefined();

    await engine.removeTorrent(testHash, true);

    // Verify native module was called with deleteFiles = true
    expect(TorrentEngineModule.removeTorrent).toHaveBeenCalledTimes(1);
    expect(TorrentEngineModule.removeTorrent).toHaveBeenCalledWith(testHash, true);

    // Verify database record was deleted
    expect(mockDb.deleteTorrent).toHaveBeenCalledTimes(1);
    expect(mockDb.deleteTorrent).toHaveBeenCalledWith(testHash);

    // Verify removed from activeTorrents
    expect(engine.getTorrent(testHash)).toBeUndefined();
  });

  it('prevents concurrent duplicate deletion calls for the same hash', async () => {
    let nativeCallCount = 0;
    TorrentEngineModule.removeTorrent.mockImplementation(async () => {
      nativeCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return true;
    });

    // Fire two removals concurrently
    const p1 = engine.removeTorrent(testHash, false);
    const p2 = engine.removeTorrent(testHash, false);

    await Promise.all([p1, p2]);

    // Only one execution should have reached the native module and DB
    expect(nativeCallCount).toBe(1);
    expect(mockDb.deleteTorrent).toHaveBeenCalledTimes(1);
  });

  it('ignores empty or invalid info-hash gracefully', async () => {
    await engine.removeTorrent('', false);
    expect(TorrentEngineModule.removeTorrent).not.toHaveBeenCalled();
    expect(mockDb.deleteTorrent).not.toHaveBeenCalled();
  });

  it('ignores native state update alerts for torrents currently pending deletion or deleted', () => {
    (engine as any).pendingDeletions.add(testHash);

    // Attempt state update alert while deleting
    (engine as any).handleStateUpdate({
      infoHash: testHash,
      downloadedBytes: 2000000000,
      downloadRate: 9999999,
    });

    const torrent = engine.getTorrent(testHash);
    // Values should NOT have been updated because it was pending deletion
    expect(torrent?.downloadRate).toBe(5000000);
  });
});
