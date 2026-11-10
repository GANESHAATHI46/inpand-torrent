import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { DatabaseService } from './DatabaseService';
import { TorrentItem, TorrentStatus, SessionSettings, DashboardStats, FilePriority } from '../types/torrent';
import { parseTorrentBase64 } from '../utils/torrentParser';

export interface IncomingTorrentIntent {
  type: 'magnet' | 'torrent_file' | 'torrent_files_multiple';
  action?: string;
  uri?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  mimeType?: string;
  name?: string;
  files?: Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType?: string;
  }>;
}

const { TorrentEngineModule } = NativeModules;
const engineEmitter = TorrentEngineModule ? new NativeEventEmitter(TorrentEngineModule) : null;

export class TorrentEngine {
  private static instance: TorrentEngine;
  private db: DatabaseService;
  private activeTorrents: Map<string, TorrentItem> = new Map();
  private pendingDeletions: Set<string> = new Set();
  private lastDbSaveTime: Map<string, number> = new Map();
  private listeners: Set<(torrents: TorrentItem[], stats: DashboardStats) => void> = new Set();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private listenersAttached = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): TorrentEngine {
    if (!TorrentEngine.instance) {
      TorrentEngine.instance = new TorrentEngine();
    }
    return TorrentEngine.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // 1. Restore persisted torrents from SQLite
        const persisted = await this.db.loadAllTorrents();
        for (const t of persisted) {
          this.activeTorrents.set(t.infoHash.toLowerCase(), t);
        }

        // 2. Attach native engine event listeners if available (once)
        if (engineEmitter && Platform.OS === 'android' && !this.listenersAttached) {
          this.listenersAttached = true;
          engineEmitter.addListener('onTorrentStateUpdated', this.handleStateUpdate.bind(this));
          engineEmitter.addListener('onTorrentFinished', this.handleTorrentFinished.bind(this));
          engineEmitter.addListener('onMetadataReceived', this.handleMetadataReceived.bind(this));
          engineEmitter.addListener('onTorrentError', this.handleTorrentError.bind(this));

          // Inform native engine to restore session with fast resume data
          try {
            await TorrentEngineModule.initializeSession();
            // Restore active torrents into native engine session
            for (const t of persisted) {
              if (t.status !== 'paused' && t.status !== 'error') {
                try {
                  if (typeof TorrentEngineModule.restoreTorrent === 'function') {
                    await TorrentEngineModule.restoreTorrent(
                      t.infoHash,
                      t.name,
                      t.savePath,
                      t.totalSize,
                      t.downloadedBytes,
                      t.status
                    );
                  }
                } catch (restErr) {
                  console.warn('Failed restoring torrent in native session:', t.infoHash, restErr);
                }
              }
            }
          } catch (e) {
            console.warn('Native TorrentEngineModule initializeSession failed:', e);
          }
        } else if (Platform.OS !== 'android') {
          // In Web / Local JS environment, automatically start mock timer if there are active torrents
          const hasActive = persisted.some(
            (t) => t.status === 'downloading' || t.status === 'downloading_metadata'
          );
          if (hasActive) {
            this.startWebMockTimer();
          }
        }

        this.isInitialized = true;
        this.notifyListeners();
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public subscribe(listener: (torrents: TorrentItem[], stats: DashboardStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllTorrents(), this.getDashboardStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getInitialTorrent(): Promise<IncomingTorrentIntent | null> {
    if (TorrentEngineModule && Platform.OS === 'android' && typeof TorrentEngineModule.getInitialTorrent === 'function') {
      try {
        return await TorrentEngineModule.getInitialTorrent();
      } catch (err) {
        console.warn('TorrentEngine.getInitialTorrent error:', err);
      }
    }
    return null;
  }

  public async readTorrentFileBase64(filePath: string): Promise<string> {
    if (TorrentEngineModule && Platform.OS === 'android' && typeof TorrentEngineModule.readTorrentFileBase64 === 'function') {
      return await TorrentEngineModule.readTorrentFileBase64(filePath);
    }
    throw new Error('readTorrentFileBase64 only supported on Android native');
  }

  public addIntentListener(listener: (payload: IncomingTorrentIntent) => void): () => void {
    if (engineEmitter && Platform.OS === 'android') {
      const sub = engineEmitter.addListener('onTorrentReceived', listener);
      return () => {
        sub.remove();
      };
    }
    return () => {};
  }

  private notifyListeners(): void {
    const list = this.getAllTorrents();
    const stats = this.getDashboardStats();
    for (const l of this.listeners) {
      l(list, stats);
    }
  }

  public getAllTorrents(): TorrentItem[] {
    return Array.from(this.activeTorrents.values());
  }

  public getTorrent(infoHash: string): TorrentItem | undefined {
    return this.activeTorrents.get(infoHash.toLowerCase());
  }

  public getDashboardStats(): DashboardStats {
    let totalDlRate = 0;
    let totalUlRate = 0;
    let totalSize = 0;
    let totalDownloaded = 0;
    let active = 0;
    let completed = 0;
    let paused = 0;

    for (const t of this.activeTorrents.values()) {
      totalDlRate += t.downloadRate;
      totalUlRate += t.uploadRate;
      totalSize += t.totalSize;
      totalDownloaded += t.downloadedBytes;

      if (
        t.status === 'downloading' ||
        t.status === 'downloading_metadata' ||
        t.status === 'checking' ||
        t.status === 'connecting_peers' ||
        t.status === 'stalled'
      ) {
        active++;
      } else if (t.status === 'finished' || t.status === 'seeding') {
        completed++;
      } else if (t.status === 'paused') {
        paused++;
      }
    }

    return {
      totalTorrents: this.activeTorrents.size,
      activeDownloads: active,
      completedDownloads: completed,
      pausedDownloads: paused,
      downloadSpeed: totalDlRate,
      uploadSpeed: totalUlRate,
      overallProgress: totalSize > 0 ? Math.min(1, totalDownloaded / totalSize) : 0,
      totalSize,
      totalDownloaded,
    };
  }

  public async addMagnet(magnetUri: string, customSavePath?: string): Promise<TorrentItem> {
    const cleanUri = magnetUri.trim();
    const match = cleanUri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    if (!match) {
      throw new Error('Invalid magnet URI: missing 40-hex or 32-base32 info-hash');
    }

    const infoHash = match[1].toLowerCase();
    if (this.activeTorrents.has(infoHash)) {
      throw new Error('Torrent with this hash is already in the download list');
    }

    // Extract name if present
    const nameMatch = cleanUri.match(/dn=([^&]+)/);
    const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : `Magnet_${infoHash.slice(0, 8)}`;

    const settings = await this.db.loadSettings();
    const savePath = customSavePath || settings.defaultSavePath;

    const newTorrent: TorrentItem = {
      infoHash,
      name,
      status: 'downloading_metadata',
      totalSize: 0,
      downloadedBytes: 0,
      uploadedBytes: 0,
      downloadRate: 0,
      uploadRate: 0,
      progress: 0,
      eta: -1,
      numSeeds: 0,
      numPeers: 0,
      totalSeeds: 0,
      totalPeers: 0,
      savePath,
      addedDate: Date.now(),
      completedDate: null,
      pieceLength: 0,
      numPieces: 0,
      files: [],
      trackers: [],
      peers: [],
    };

    await this.db.insertTorrent(newTorrent);
    this.activeTorrents.set(infoHash, newTorrent);

    if (TorrentEngineModule && Platform.OS === 'android') {
      try {
        await TorrentEngineModule.addMagnet(cleanUri, savePath);
      } catch (err) {
        console.warn('Native addMagnet call error:', err);
        this.activeTorrents.delete(infoHash);
        await this.db.deleteTorrent(infoHash).catch(() => {});
        throw err;
      }
    } else {
      // In Web / JS environment, immediately activate download simulation
      this.startWebMockTimer();
    }

    this.notifyListeners();
    return newTorrent;
  }

  private webTimer: any = null;

  private startWebMockTimer(): void {
    if (this.webTimer || Platform.OS === 'android') return;
    this.webTimer = setInterval(() => {
      let hasActive = false;
      for (const t of this.activeTorrents.values()) {
        if (t.status === 'downloading_metadata') {
          hasActive = true;
          t.status = 'downloading';
          t.totalSize = t.totalSize > 0 ? t.totalSize : 2147483648; // 2.0 GB default
          t.downloadRate = 3200000;
          t.uploadRate = 450000;
          t.numSeeds = 42;
          t.numPeers = 78;
          t.totalSeeds = 60;
          t.totalPeers = 120;
          this.db.updateTorrentStatus(t.infoHash, 'downloading');
        } else if (t.status === 'downloading') {
          hasActive = true;
          if (t.downloadRate === 0) {
            t.downloadRate = 2800000 + Math.floor(Math.random() * 800000);
          }
          const inc = Math.min(
            Math.max(0, t.totalSize - t.downloadedBytes),
            t.downloadRate > 0 ? t.downloadRate : 2500000
          );
          t.downloadedBytes += inc;
          t.progress = t.totalSize > 0 ? Math.min(1, t.downloadedBytes / t.totalSize) : 0;
          t.eta = t.downloadRate > 0 && t.totalSize > t.downloadedBytes
            ? Math.ceil((t.totalSize - t.downloadedBytes) / t.downloadRate)
            : 0;
          if (t.downloadedBytes >= t.totalSize && t.totalSize > 0) {
            t.status = 'finished';
            t.downloadRate = 0;
            t.completedDate = Date.now();
            this.db.updateTorrentStatus(t.infoHash, 'finished');
          }
        }
      }
      if (hasActive) {
        this.notifyListeners();
      }
    }, 1000);
  }

  public async addTorrentFile(fileBytesBase64: string, name: string, customSavePath?: string): Promise<TorrentItem> {
    const settings = await this.db.loadSettings();
    const savePath = customSavePath || settings.defaultSavePath;

    // 1. Parse and validate bencoded metadata
    let parsedMeta: any = null;
    try {
      parsedMeta = parseTorrentBase64(fileBytesBase64);
    } catch (parseErr: any) {
      console.warn('JS bencode parse warning (will rely on native):', parseErr?.message);
    }

    const proposedHash = (parsedMeta?.infoHash || '').toLowerCase();
    if (proposedHash && this.activeTorrents.has(proposedHash)) {
      throw new Error('Torrent with this hash is already in the download list');
    }

    if (TorrentEngineModule && Platform.OS === 'android') {
      let infoHash = '';
      try {
        const result = await TorrentEngineModule.addTorrentFile(fileBytesBase64, savePath);
        infoHash = (result.infoHash || proposedHash).toLowerCase();

        if (this.activeTorrents.has(infoHash)) {
          throw new Error('Torrent with this hash is already in the download list');
        }

        const rawFiles = result.files && result.files.length > 0 ? result.files : parsedMeta?.files || [];
        const formattedFiles = rawFiles.map((f: any, idx: number) => ({
          index: typeof f.index === 'number' ? f.index : idx,
          path: f.path || `file_${idx}`,
          size: Number(f.size) || 0,
          offset: Number(f.offset) || 0,
          downloadedBytes: Number(f.downloadedBytes) || 0,
          priority: (Number(f.priority) || 4) as FilePriority,
          progress: f.size > 0 ? (Number(f.downloadedBytes) || 0) / Number(f.size) : 0,
        }));

        const rawTrackers = result.trackers && result.trackers.length > 0 ? result.trackers : parsedMeta?.trackers || [];
        const formattedTrackers = rawTrackers.map((tr: any, idx: number) => {
          if (typeof tr === 'string') {
            return {
              url: tr,
              tier: idx,
              status: 'not_contacted',
              peers: 0,
              seeds: 0,
              message: '',
            };
          }
          return {
            url: tr.url || '',
            tier: typeof tr.tier === 'number' ? tr.tier : idx,
            status: tr.status || 'not_contacted',
            peers: Number(tr.peers) || 0,
            seeds: Number(tr.seeds) || 0,
            message: tr.message || '',
          };
        });

        const item: TorrentItem = {
          infoHash,
          name: result.name || parsedMeta?.name || name,
          status: (result.status as TorrentStatus) || 'connecting_peers',
          totalSize: Number(result.totalSize) || Number(parsedMeta?.totalSize) || 0,
          downloadedBytes: 0,
          uploadedBytes: 0,
          downloadRate: 0,
          uploadRate: 0,
          progress: 0,
          eta: -1,
          numSeeds: 0,
          numPeers: 0,
          totalSeeds: 0,
          totalPeers: 0,
          savePath,
          addedDate: Date.now(),
          completedDate: null,
          pieceLength: Number(result.pieceLength) || Number(parsedMeta?.pieceLength) || 0,
          numPieces: Number(result.numPieces) || Number(parsedMeta?.numPieces) || 0,
          files: formattedFiles,
          trackers: formattedTrackers,
          peers: [],
        };

        await this.db.insertTorrent(item);
        this.activeTorrents.set(infoHash, item);
        this.notifyListeners();
        return item;
      } catch (err: any) {
        if (infoHash && TorrentEngineModule && typeof TorrentEngineModule.removeTorrent === 'function') {
          try {
            await TorrentEngineModule.removeTorrent(infoHash, false);
          } catch (_) {}
        }
        throw new Error(err?.message || `Failed to add torrent: ${err}`);
      }
    } else {
      // In standalone JS / Web environment
      const infoHash = proposedHash || `torrent_${Date.now().toString(16).slice(0, 8)}`.padEnd(40, '0');
      if (this.activeTorrents.has(infoHash)) {
        throw new Error('Torrent with this hash is already in the download list');
      }

      const item: TorrentItem = {
        infoHash,
        name: parsedMeta?.name || name,
        status: 'downloading',
        totalSize: parsedMeta?.totalSize || 50000000,
        downloadedBytes: 0,
        uploadedBytes: 0,
        downloadRate: 1500000,
        uploadRate: 200000,
        progress: 0,
        eta: Math.ceil((parsedMeta?.totalSize || 50000000) / 1500000),
        numSeeds: 15,
        numPeers: 28,
        totalSeeds: 25,
        totalPeers: 45,
        savePath,
        addedDate: Date.now(),
        completedDate: null,
        pieceLength: parsedMeta?.pieceLength || 65536,
        numPieces: parsedMeta?.numPieces || 100,
        files: parsedMeta?.files || [{ index: 0, path: name, size: 50000000, offset: 0, downloadedBytes: 0, priority: 4, progress: 0 }],
        trackers: parsedMeta?.trackers || [],
        peers: [],
      };
      await this.db.insertTorrent(item);
      this.activeTorrents.set(infoHash, item);
      this.startWebMockTimer();
      this.notifyListeners();
      return item;
    }
  }

  public async pauseTorrent(infoHash: string): Promise<void> {
    const hash = infoHash.toLowerCase();
    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.status = 'paused';
    t.downloadRate = 0;
    t.uploadRate = 0;
    await this.db.updateTorrentStatus(hash, 'paused');

    if (TorrentEngineModule && Platform.OS === 'android') {
      try {
        await TorrentEngineModule.pauseTorrent(hash);
      } catch (err) {
        console.warn('Native pause error:', err);
      }
    }
    this.notifyListeners();
  }

  public async resumeTorrent(infoHash: string): Promise<void> {
    const hash = infoHash.toLowerCase();
    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.status = t.totalSize > 0 && t.downloadedBytes >= t.totalSize ? 'seeding' : 'downloading';
    await this.db.updateTorrentStatus(hash, t.status);

    if (TorrentEngineModule && Platform.OS === 'android') {
      try {
        await TorrentEngineModule.resumeTorrent(hash);
      } catch (err) {
        console.warn('Native resume error:', err);
      }
    } else {
      this.startWebMockTimer();
    }
    this.notifyListeners();
  }

  public isDeleting(infoHash: string): boolean {
    return this.pendingDeletions.has(infoHash.toLowerCase());
  }

  public async removeTorrent(infoHash: string, deleteFiles: boolean = false): Promise<void> {
    if (!infoHash) return;
    const hash = infoHash.toLowerCase();

    // Prevent re-entrant or duplicate deletion calls for the same torrent
    if (this.pendingDeletions.has(hash)) {
      return;
    }
    this.pendingDeletions.add(hash);

    try {
      // 1. Remove from Native libtorrent Engine first (stops network I/O, threads, alert callbacks)
      if (TorrentEngineModule && Platform.OS === 'android') {
        try {
          await TorrentEngineModule.removeTorrent(hash, deleteFiles);
        } catch (err) {
          console.warn('Native removeTorrent error:', err);
        }
      }

      // 2. Cascade delete from SQLite (torrents, torrent_files, trackers)
      try {
        await this.db.deleteTorrent(hash);
      } catch (err) {
        console.warn('Database deleteTorrent error:', err);
      }

      // 3. Remove from in-memory state
      this.activeTorrents.delete(hash);

      // 4. Notify all UI subscribers with updated list and recalculated stats
      this.notifyListeners();
    } finally {
      this.pendingDeletions.delete(hash);
    }
  }

  public async pauseAll(): Promise<void> {
    for (const t of this.activeTorrents.values()) {
      if (
        t.status === 'downloading' ||
        t.status === 'downloading_metadata' ||
        t.status === 'connecting_peers' ||
        t.status === 'stalled'
      ) {
        await this.pauseTorrent(t.infoHash);
      }
    }
  }

  public async resumeAll(): Promise<void> {
    for (const t of this.activeTorrents.values()) {
      if (t.status === 'paused') {
        await this.resumeTorrent(t.infoHash);
      }
    }
  }

  private handleStateUpdate(payload: any): void {
    let data = payload;
    if (payload && payload.stateJson && typeof payload.stateJson === 'string') {
      try {
        const parsed = JSON.parse(payload.stateJson);
        data = { ...parsed, ...payload };
      } catch (e) {
        // ignore parse error
      }
    }

    const hash = (data.infoHash || data.info_hash || '').toLowerCase();
    if (!hash || this.pendingDeletions.has(hash)) return;

    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.downloadedBytes = data.downloadedBytes ?? data.downloaded_bytes ?? t.downloadedBytes;
    t.uploadedBytes = data.uploadedBytes ?? data.uploaded_bytes ?? t.uploadedBytes;
    t.downloadRate = data.downloadRate ?? data.download_rate ?? 0;
    t.uploadRate = data.uploadRate ?? data.upload_rate ?? 0;
    t.numSeeds = data.numSeeds ?? data.num_seeds ?? 0;
    t.numPeers = data.numPeers ?? data.num_peers ?? 0;
    t.totalSeeds = data.totalSeeds ?? data.total_seeds ?? t.totalSeeds;
    t.totalPeers = data.totalPeers ?? data.total_peers ?? t.totalPeers;
    t.progress = t.totalSize > 0 ? Math.min(1, Math.max(0, t.downloadedBytes / t.totalSize)) : 0;
    t.eta = t.downloadRate > 0 && t.totalSize > t.downloadedBytes
      ? Math.ceil((t.totalSize - t.downloadedBytes) / t.downloadRate)
      : -1;

    if (t.status !== 'paused' && t.status !== 'error') {
      if (t.totalSize > 0 && t.downloadedBytes >= t.totalSize) {
        t.status = 'finished';
        t.downloadRate = 0;
      } else if (data.status) {
        t.status = data.status as TorrentStatus;
      } else if (t.downloadRate > 0 || t.numPeers > 0) {
        t.status = 'downloading';
      } else if (t.status === 'downloading') {
        t.status = 'connecting_peers';
      }
    }

    if (data.piecesProgress) {
      t.piecesProgress = data.piecesProgress;
    }

    // Persist progress to SQLite throttled every 3 seconds per torrent
    const now = Date.now();
    const lastSaved = this.lastDbSaveTime.get(hash) || 0;
    if (now - lastSaved >= 3000) {
      this.lastDbSaveTime.set(hash, now);
      this.db.updateTorrentProgress(hash, t.downloadedBytes, t.uploadedBytes).catch(() => {});
    }

    this.notifyListeners();
  }

  private handleTorrentFinished(payload: any): void {
    const hash = (payload.infoHash || payload.info_hash || '').toLowerCase();
    if (!hash || this.pendingDeletions.has(hash)) return;

    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.status = 'finished';
    t.downloadRate = 0;
    t.completedDate = Date.now();
    this.db.updateTorrentStatus(hash, 'finished').catch(() => {});
    this.db.updateTorrentProgress(hash, t.downloadedBytes, t.uploadedBytes, t.completedDate).catch(() => {});
    this.notifyListeners();
  }

  private handleMetadataReceived(payload: any): void {
    let data = payload;
    if (payload && payload.metadataJson && typeof payload.metadataJson === 'string') {
      try {
        const parsed = JSON.parse(payload.metadataJson);
        data = { ...parsed, ...payload };
      } catch (e) {
        // ignore parse error
      }
    }

    const hash = (data.infoHash || data.info_hash || '').toLowerCase();
    if (!hash || this.pendingDeletions.has(hash)) return;

    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.name = data.name || t.name;
    t.totalSize = data.totalSize ?? data.total_size ?? t.totalSize;
    t.pieceLength = data.pieceLength ?? data.piece_length ?? t.pieceLength;
    t.numPieces = data.numPieces ?? data.num_pieces ?? t.numPieces;
    t.status = 'connecting_peers';
    if (data.files) t.files = data.files;
    if (data.trackers) t.trackers = data.trackers;

    this.db.updateTorrentStatus(hash, 'connecting_peers').catch(() => {});
    this.notifyListeners();
  }

  private handleTorrentError(payload: any): void {
    const hash = (payload.infoHash || '').toLowerCase();
    if (this.pendingDeletions.has(hash)) return;

    const t = this.activeTorrents.get(hash);
    if (!t) return;

    t.status = 'error';
    t.errorMessage = payload.errorMessage || 'Native torrent engine error';
    this.db.updateTorrentStatus(hash, 'error', t.errorMessage || undefined);
    this.notifyListeners();
  }
}

