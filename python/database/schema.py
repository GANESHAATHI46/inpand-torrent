"""SQLite database schema and migrations for TorrentFlow Mobile."""

SCHEMA_VERSION = 2

MIGRATIONS = {
    1: """
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
    """,
    2: """
    -- Migration 2: Add session_history and fast resume index
    CREATE TABLE IF NOT EXISTS session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        total_downloaded INTEGER NOT NULL,
        total_uploaded INTEGER NOT NULL,
        active_torrents INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_torrents_queue ON torrents(queue_position);
    """
}

