import AsyncStorage from '@react-native-async-storage/async-storage';
import { TorrentItem, SessionSettings, TorrentStatus, FilePriority } from '../types/torrent';

const STORAGE_TORRENTS_KEY = '@torrentflow_web_torrents';
const STORAGE_SETTINGS_KEY = '@torrentflow_web_settings';

export class DatabaseService {
  private static instance: DatabaseService;
  private torrentsCache: Map<string, TorrentItem> = new Map();
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_TORRENTS_KEY);
      if (raw) {
        const parsed: TorrentItem[] = JSON.parse(raw);
        for (const t of parsed) {
          this.torrentsCache.set(t.infoHash.toLowerCase(), t);
        }
      }
    } catch (e) {
      console.warn('Web storage load error:', e);
    }
    this.isLoaded = true;
  }

  private async persist(): Promise<void> {
    try {
      const list = Array.from(this.torrentsCache.values());
      await AsyncStorage.setItem(STORAGE_TORRENTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Web storage persist error:', e);
    }
  }

  public async loadAllTorrents(): Promise<TorrentItem[]> {
    await this.ensureLoaded();
    return Array.from(this.torrentsCache.values());
  }

  public async insertTorrent(torrent: Partial<TorrentItem>): Promise<void> {
    await this.ensureLoaded();
    const hash = (torrent.infoHash || '').toLowerCase();
    if (this.torrentsCache.has(hash)) {
      throw new Error(`Torrent with hash ${hash} already exists`);
    }

    const item: TorrentItem = {
      infoHash: hash,
      name: torrent.name || 'Unnamed',
      status: (torrent.status as TorrentStatus) || 'checking',
      totalSize: torrent.totalSize || 0,
      downloadedBytes: torrent.downloadedBytes || 0,
      uploadedBytes: torrent.uploadedBytes || 0,
      downloadRate: 0,
      uploadRate: 0,
      progress: torrent.totalSize ? Math.min(1, (torrent.downloadedBytes || 0) / torrent.totalSize) : 0,
      eta: -1,
      numSeeds: 0,
      numPeers: 0,
      totalSeeds: 0,
      totalPeers: 0,
      savePath: torrent.savePath || '/storage/emulated/0/Download/TorrentFlow',
      addedDate: torrent.addedDate || Date.now(),
      completedDate: torrent.completedDate || null,
      pieceLength: torrent.pieceLength || 0,
      numPieces: torrent.numPieces || 0,
      errorMessage: torrent.errorMessage || null,
      files: torrent.files || [],
      trackers: torrent.trackers || [],
      peers: [],
    };

    this.torrentsCache.set(hash, item);
    await this.persist();
  }

  public async updateTorrentStatus(
    infoHash: string,
    status: TorrentStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.ensureLoaded();
    const hash = infoHash.toLowerCase();
    const t = this.torrentsCache.get(hash);
    if (t) {
      t.status = status;
      if (errorMessage !== undefined) t.errorMessage = errorMessage;
      await this.persist();
    }
  }

  public async updateTorrentProgress(
    infoHash: string,
    downloaded: number,
    uploaded: number,
    completedDate?: number | null
  ): Promise<void> {
    await this.ensureLoaded();
    const hash = infoHash.toLowerCase();
    const t = this.torrentsCache.get(hash);
    if (t) {
      t.downloadedBytes = downloaded;
      t.uploadedBytes = uploaded;
      t.progress = t.totalSize > 0 ? Math.min(1, downloaded / t.totalSize) : 0;
      if (completedDate !== undefined) t.completedDate = completedDate;
      await this.persist();
    }
  }

  public async deleteTorrent(infoHash: string): Promise<void> {
    await this.ensureLoaded();
    const hash = infoHash.toLowerCase();
    this.torrentsCache.delete(hash);
    await this.persist();
  }

  public async saveSettings(settings: SessionSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Web save settings error:', e);
    }
  }

  public async loadSettings(): Promise<SessionSettings> {
    const defaults: SessionSettings = {
      downloadRateLimit: 0,
      uploadRateLimit: 0,
      maxActiveDownloads: 5,
      maxActiveUploads: 5,
      maxConnections: 200,
      dhtEnabled: true,
      pexEnabled: true,
      lsdEnabled: true,
      wifiOnly: false,
      mobileDataWarning: true,
      listenPort: 6881,
      defaultSavePath: '/storage/emulated/0/Download/InpandTorrent',
      darkMode: true,
    };

    try {
      const raw = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch {
      // Return defaults
    }
    return defaults;
  }
}

