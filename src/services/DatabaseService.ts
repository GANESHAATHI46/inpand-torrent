import * as SQLite from 'expo-sqlite';
import { TorrentItem, SessionSettings, TorrentStatus, FilePriority, Tracker, TorrentFile } from '../types/torrent';

const DB_NAME = 'torrentflow.db';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Returns a ready-to-use SQLiteDatabase instance.
   * Guarantees atomic, single-flight initialization even when called
   * concurrently from multiple startup components or background tasks.
   */
  public async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        // Open the database synchronously to avoid race conditions in the native bridge
        const db = SQLite.openDatabaseSync(DB_NAME);
        await this.initSchema(db);
        this.db = db;
        return db;
      } catch (err) {
        this.initPromise = null;
        this.db = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Initializes schema and indexes atomically.
   */
  private async initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS torrents (
        info_hash TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_size INTEGER NOT NULL,
        downloaded_bytes INTEGER DEFAULT 0,
        uploaded_bytes INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        save_path TEXT NOT NULL,
        piece_length INTEGER DEFAULT 0,
        num_pieces INTEGER DEFAULT 0,
        added_date INTEGER NOT NULL,
        completed_date INTEGER,
        resume_data BLOB,
        error_message TEXT,
        queue_position INTEGER DEFAULT 0,
        is_sequential INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS torrent_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        info_hash TEXT NOT NULL,
        file_index INTEGER NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        offset INTEGER NOT NULL,
        downloaded_bytes INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 4,
        FOREIGN KEY (info_hash) REFERENCES torrents(info_hash) ON DELETE CASCADE,
        UNIQUE (info_hash, file_index)
      );

      CREATE TABLE IF NOT EXISTS trackers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        info_hash TEXT NOT NULL,
        url TEXT NOT NULL,
        tier INTEGER DEFAULT 0,
        status TEXT DEFAULT 'not_contacted',
        peers INTEGER DEFAULT 0,
        seeds INTEGER DEFAULT 0,
        message TEXT DEFAULT '',
        FOREIGN KEY (info_hash) REFERENCES torrents(info_hash) ON DELETE CASCADE,
        UNIQUE (info_hash, url)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_torrents_status ON torrents(status);
      CREATE INDEX IF NOT EXISTS idx_torrent_files_hash ON torrent_files(info_hash);
      CREATE INDEX IF NOT EXISTS idx_trackers_hash ON trackers(info_hash);
    `);

    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?);`,
        [Date.now()]
      );
    } catch (_) {}
  }

  public async loadAllTorrents(): Promise<TorrentItem[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM torrents ORDER BY queue_position ASC;`
    );

    const torrents: TorrentItem[] = [];

    for (const r of rows) {
      const fileRows = await db.getAllAsync<any>(
        `SELECT * FROM torrent_files WHERE info_hash = ? ORDER BY file_index ASC;`,
        [r.info_hash]
      );
      const trackerRows = await db.getAllAsync<any>(
        `SELECT * FROM trackers WHERE info_hash = ? ORDER BY tier ASC;`,
        [r.info_hash]
      );

      const totalSize = Number(r.total_size) || 0;
      const downloaded = Number(r.downloaded_bytes) || 0;
      const progress = totalSize > 0 ? Math.min(1, Math.max(0, downloaded / totalSize)) : 0;

      torrents.push({
        infoHash: r.info_hash,
        name: r.name,
        status: r.status as TorrentStatus,
        totalSize,
        downloadedBytes: downloaded,
        uploadedBytes: Number(r.uploaded_bytes) || 0,
        downloadRate: 0,
        uploadRate: 0,
        progress,
        eta: -1,
        numSeeds: 0,
        numPeers: 0,
        totalSeeds: 0,
        totalPeers: 0,
        savePath: r.save_path,
        addedDate: Number(r.added_date),
        completedDate: r.completed_date ? Number(r.completed_date) : null,
        pieceLength: Number(r.piece_length) || 0,
        numPieces: Number(r.num_pieces) || 0,
        errorMessage: r.error_message || null,
        files: fileRows.map((f) => ({
          index: Number(f.file_index) || 0,
          path: f.path || '',
          size: Number(f.size) || 0,
          offset: Number(f.offset) || 0,
          downloadedBytes: Number(f.downloaded_bytes) || 0,
          priority: (Number(f.priority) || 4) as FilePriority,
          progress: f.size > 0 ? (Number(f.downloaded_bytes) || 0) / Number(f.size) : 1,
        })),
        trackers: trackerRows.map((t) => ({
          url: t.url,
          tier: Number(t.tier) || 0,
          status: t.status || 'not_contacted',
          peers: Number(t.peers) || 0,
          seeds: Number(t.seeds) || 0,
          message: t.message || '',
        })),
        peers: [],
      });
    }

    return torrents;
  }

  /**
   * Atomically inserts a torrent and its associated files and trackers.
   * Runs inside an explicit transaction so that failures never leave orphaned rows,
   * and parameters are sanitized to prevent NullPointerExceptions in native SQLite.
   */
  public async insertTorrent(torrent: Partial<TorrentItem>): Promise<void> {
    const db = await this.getDb();
    const hash = (torrent.infoHash || '').toLowerCase().trim();
    if (!hash) {
      throw new Error('Cannot insert torrent without a valid infoHash');
    }

    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<any>(
        `SELECT 1 FROM torrents WHERE info_hash = ? LIMIT 1;`,
        [hash]
      );
      if (existing) {
        throw new Error(`Torrent with hash ${hash} already exists`);
      }

      const posRow = await db.getFirstAsync<any>(
        `SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos FROM torrents;`
      );
      const nextPos = posRow?.next_pos || 1;

      await db.runAsync(
        `INSERT INTO torrents (
          info_hash, name, total_size, downloaded_bytes, uploaded_bytes,
          status, save_path, piece_length, num_pieces, added_date, queue_position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          hash,
          torrent.name || 'Unnamed',
          typeof torrent.totalSize === 'number' ? torrent.totalSize : 0,
          typeof torrent.downloadedBytes === 'number' ? torrent.downloadedBytes : 0,
          typeof torrent.uploadedBytes === 'number' ? torrent.uploadedBytes : 0,
          torrent.status || 'checking',
          torrent.savePath || '',
          typeof torrent.pieceLength === 'number' ? torrent.pieceLength : 0,
          typeof torrent.numPieces === 'number' ? torrent.numPieces : 0,
          typeof torrent.addedDate === 'number' ? torrent.addedDate : Date.now(),
          nextPos,
        ]
      );

      if (Array.isArray(torrent.files) && torrent.files.length > 0) {
        for (let i = 0; i < torrent.files.length; i++) {
          const f = torrent.files[i];
          const fileIndex = typeof f.index === 'number' ? f.index : i;
          const filePath = typeof f.path === 'string' && f.path.trim() ? f.path.trim() : `file_${fileIndex}`;
          const fileSize = typeof f.size === 'number' ? f.size : 0;
          const fileOffset = typeof f.offset === 'number' ? f.offset : 0;
          const downloadedBytes = typeof f.downloadedBytes === 'number' ? f.downloadedBytes : 0;
          const priority = typeof f.priority === 'number' ? f.priority : 4;

          await db.runAsync(
            `INSERT OR REPLACE INTO torrent_files (
              info_hash, file_index, path, size, offset, downloaded_bytes, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [hash, fileIndex, filePath, fileSize, fileOffset, downloadedBytes, priority]
          );
        }
      }

      if (Array.isArray(torrent.trackers) && torrent.trackers.length > 0) {
        for (let i = 0; i < torrent.trackers.length; i++) {
          const tr = torrent.trackers[i] as any;
          let url = '';
          let tier = i;
          if (typeof tr === 'string') {
            url = tr.trim();
          } else if (tr && typeof tr === 'object') {
            url = typeof tr.url === 'string' ? tr.url.trim() : '';
            if (typeof tr.tier === 'number') tier = tr.tier;
          }
          if (!url) continue;

          await db.runAsync(
            `INSERT OR IGNORE INTO trackers (info_hash, url, tier) VALUES (?, ?, ?);`,
            [hash, url, tier]
          );
        }
      }
    });
  }

  public async updateTorrentStatus(
    infoHash: string,
    status: TorrentStatus,
    errorMessage?: string
  ): Promise<void> {
    const db = await this.getDb();
    const hash = (infoHash || '').toLowerCase().trim();
    if (!hash) return;
    await db.runAsync(
      `UPDATE torrents SET status = ?, error_message = ? WHERE info_hash = ?;`,
      [status, errorMessage ?? null, hash]
    );
  }

  public async updateTorrentProgress(
    infoHash: string,
    downloaded: number,
    uploaded: number,
    completedDate?: number | null
  ): Promise<void> {
    const db = await this.getDb();
    const hash = (infoHash || '').toLowerCase().trim();
    if (!hash) return;
    if (completedDate) {
      await db.runAsync(
        `UPDATE torrents SET downloaded_bytes = ?, uploaded_bytes = ?, completed_date = ? WHERE info_hash = ?;`,
        [downloaded || 0, uploaded || 0, completedDate, hash]
      );
    } else {
      await db.runAsync(
        `UPDATE torrents SET downloaded_bytes = ?, uploaded_bytes = ? WHERE info_hash = ?;`,
        [downloaded || 0, uploaded || 0, hash]
      );
    }
  }

  public async deleteTorrent(infoHash: string): Promise<void> {
    const db = await this.getDb();
    const hash = (infoHash || '').toLowerCase().trim();
    if (!hash) return;
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM torrent_files WHERE info_hash = ?;`, [hash]);
      await db.runAsync(`DELETE FROM trackers WHERE info_hash = ?;`, [hash]);
      await db.runAsync(`DELETE FROM torrents WHERE info_hash = ?;`, [hash]);
    });
  }

  public async saveSettings(settings: SessionSettings): Promise<void> {
    const db = await this.getDb();
    const entries = Object.entries(settings);
    await db.withTransactionAsync(async () => {
      for (const [k, v] of entries) {
        await db.runAsync(
          `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`,
          [k, String(v ?? '')]
        );
      }
    });
  }

  public async loadSettings(): Promise<SessionSettings> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<any>(`SELECT key, value FROM settings;`);
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

    if (!rows || rows.length === 0) return defaults;

    const result = { ...defaults };
    for (const r of rows) {
      const k = r.key as keyof SessionSettings;
      if (k in result) {
        if (typeof defaults[k] === 'boolean') {
          (result[k] as any) = r.value === 'true' || r.value === '1';
        } else if (typeof defaults[k] === 'number') {
          (result[k] as any) = Number(r.value) || 0;
        } else {
          (result[k] as any) = r.value;
        }
      }
    }
    return result;
  }

  public async closeDatabase(): Promise<void> {
    if (this.db) {
      try {
        await this.db.closeAsync();
      } catch (_) {}
      this.db = null;
      this.initPromise = null;
    }
  }
}
