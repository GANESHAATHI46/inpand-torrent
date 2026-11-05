"""SQLite Database Manager for TorrentFlow Mobile.

Handles transactional data access, migrations, duplicate prevention, and session recovery.
"""

import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Dict, List, Optional, Any, Tuple
from .schema import SCHEMA_VERSION, MIGRATIONS
from ..core.types import TorrentStatus, TorrentSnapshot, TorrentFileEntry, TrackerEntry, FilePriority, SessionSettings


class DatabaseError(Exception):
    """Base exception for SQLite operations."""
    pass


class DuplicateTorrentError(DatabaseError):
    """Raised when attempting to add a torrent that already exists."""
    pass


class DatabaseManager:
    """Thread-safe SQLite database manager for torrent and session persistence."""

    def __init__(self, db_path: str = "torrentflow.db"):
        self.db_path = db_path
        self._mem_conn: Optional[sqlite3.Connection] = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
            self._mem_conn.execute("PRAGMA foreign_keys = ON;")
        self._ensure_directory()
        self._init_database()

    def _ensure_directory(self) -> None:
        if self.db_path != ":memory:":
            dirname = os.path.dirname(self.db_path)
            if dirname and not os.path.exists(dirname):
                os.makedirs(dirname, exist_ok=True)

    def get_connection(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        return conn

    @contextmanager
    def transaction(self):
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            if self._mem_conn is None:
                conn.close()

    def _init_database(self) -> None:
        """Run pending schema migrations sequentially."""
        with self.transaction() as conn:
            # Check current schema version
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER NOT NULL
                );
            """)
            cur = conn.execute("SELECT MAX(version) FROM schema_migrations;")
            row = cur.fetchone()
            current_version = row[0] if row and row[0] is not None else 0

            for ver in range(current_version + 1, SCHEMA_VERSION + 1):
                if ver in MIGRATIONS:
                    conn.executescript(MIGRATIONS[ver])
                    conn.execute(
                        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                        (ver, int(time.time()))
                    )

    def has_torrent(self, info_hash: str) -> bool:
        """Check if a torrent with given info-hash already exists."""
        with self.transaction() as conn:
            cur = conn.execute("SELECT 1 FROM torrents WHERE info_hash = ? LIMIT 1;", (info_hash.lower(),))
            return cur.fetchone() is not None

    def add_torrent(
        self,
        info_hash: str,
        name: str,
        total_size: int,
        save_path: str,
        piece_length: int = 0,
        num_pieces: int = 0,
        status: TorrentStatus = TorrentStatus.CHECKING,
        files: Optional[List[TorrentFileEntry]] = None,
        trackers: Optional[List[str]] = None,
    ) -> None:
        """Add a new torrent and its initial file/tracker records. Raises DuplicateTorrentError if exists."""
        hash_lower = info_hash.lower()
        with self.transaction() as conn:
            # Check duplicate
            cur = conn.execute("SELECT 1 FROM torrents WHERE info_hash = ?;", (hash_lower,))
            if cur.fetchone() is not None:
                raise DuplicateTorrentError(f"Torrent with hash {hash_lower} already exists")

            # Determine next queue position
            cur = conn.execute("SELECT COALESCE(MAX(queue_position), 0) + 1 FROM torrents;")
            queue_pos = cur.fetchone()[0]

            conn.execute("""
                INSERT INTO torrents (
                    info_hash, name, total_size, downloaded_bytes, uploaded_bytes,
                    status, save_path, piece_length, num_pieces, added_date, queue_position
                ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?);
            """, (
                hash_lower, name, total_size, status.value, save_path,
                piece_length, num_pieces, int(time.time() * 1000), queue_pos
            ))

            # Insert files
            if files:
                for f in files:
                    conn.execute("""
                        INSERT INTO torrent_files (
                            info_hash, file_index, path, size, offset, downloaded_bytes, priority
                        ) VALUES (?, ?, ?, ?, ?, ?, ?);
                    """, (hash_lower, f.index, f.path, f.size, f.offset, f.downloaded_bytes, int(f.priority.value)))

            # Insert trackers
            if trackers:
                for idx, tr in enumerate(trackers):
                    conn.execute("""
                        INSERT OR IGNORE INTO trackers (info_hash, url, tier)
                        VALUES (?, ?, ?);
                    """, (hash_lower, tr, idx))

    def update_torrent_status(self, info_hash: str, status: TorrentStatus, error_message: Optional[str] = None) -> None:
        """Update operational status and optional error message."""
        with self.transaction() as conn:
            conn.execute("""
                UPDATE torrents
                SET status = ?, error_message = ?
                WHERE info_hash = ?;
            """, (status.value, error_message, info_hash.lower()))

    def update_torrent_progress(
        self,
        info_hash: str,
        downloaded_bytes: int,
        uploaded_bytes: int,
        completed_date: Optional[int] = None,
    ) -> None:
        """Update cumulative downloaded/uploaded counts."""
        with self.transaction() as conn:
            if completed_date:
                conn.execute("""
                    UPDATE torrents
                    SET downloaded_bytes = ?, uploaded_bytes = ?, completed_date = ?
                    WHERE info_hash = ?;
                """, (downloaded_bytes, uploaded_bytes, completed_date, info_hash.lower()))
            else:
                conn.execute("""
                    UPDATE torrents
                    SET downloaded_bytes = ?, uploaded_bytes = ?
                    WHERE info_hash = ?;
                """, (downloaded_bytes, uploaded_bytes, info_hash.lower()))

    def save_resume_data(self, info_hash: str, resume_bytes: bytes) -> None:
        """Persist fast resume binary blob from libtorrent."""
        with self.transaction() as conn:
            conn.execute("""
                UPDATE torrents
                SET resume_data = ?
                WHERE info_hash = ?;
            """, (sqlite3.Binary(resume_bytes), info_hash.lower()))

    def get_resume_data(self, info_hash: str) -> Optional[bytes]:
        """Retrieve fast resume data for session restoration."""
        with self.transaction() as conn:
            cur = conn.execute("SELECT resume_data FROM torrents WHERE info_hash = ?;", (info_hash.lower(),))
            row = cur.fetchone()
            if row and row["resume_data"] is not None:
                return bytes(row["resume_data"])
            return None

    def get_all_torrents(self) -> List[Dict[str, Any]]:
        """Retrieve all persisted torrents for session recovery on app restart."""
        with self.transaction() as conn:
            cur = conn.execute("""
                SELECT info_hash, name, total_size, downloaded_bytes, uploaded_bytes,
                       status, save_path, piece_length, num_pieces, added_date,
                       completed_date, error_message, queue_position
                FROM torrents
                ORDER BY queue_position ASC;
            """)
            torrents = []
            for row in cur.fetchall():
                t_dict = dict(row)
                # Fetch files
                f_cur = conn.execute("""
                    SELECT file_index, path, size, offset, downloaded_bytes, priority
                    FROM torrent_files
                    WHERE info_hash = ?
                    ORDER BY file_index ASC;
                """, (t_dict["info_hash"],))
                t_dict["files"] = [dict(f) for f in f_cur.fetchall()]

                # Fetch trackers
                tr_cur = conn.execute("""
                    SELECT url, tier, status, peers, seeds, message
                    FROM trackers
                    WHERE info_hash = ?
                    ORDER BY tier ASC;
                """, (t_dict["info_hash"],))
                t_dict["trackers"] = [dict(tr) for tr in tr_cur.fetchall()]

                torrents.append(t_dict)
            return torrents

    def remove_torrent(self, info_hash: str) -> None:
        """Remove torrent and cascaded records from SQLite."""
        with self.transaction() as conn:
            conn.execute("DELETE FROM torrents WHERE info_hash = ?;", (info_hash.lower(),))

    def set_file_priority(self, info_hash: str, file_index: int, priority: FilePriority) -> None:
        """Update individual file priority."""
        with self.transaction() as conn:
            conn.execute("""
                UPDATE torrent_files
                SET priority = ?
                WHERE info_hash = ? AND file_index = ?;
            """, (int(priority.value), info_hash.lower(), file_index))

    def save_settings(self, settings: SessionSettings) -> None:
        """Persist session configuration."""
        with self.transaction() as conn:
            for k, v in settings.to_dict().items():
                conn.execute("""
                    INSERT OR REPLACE INTO settings (key, value)
                    VALUES (?, ?);
                """, (k, str(v)))

    def load_settings(self) -> SessionSettings:
        """Load session configuration or defaults."""
        s = SessionSettings()
        with self.transaction() as conn:
            cur = conn.execute("SELECT key, value FROM settings;")
            for row in cur.fetchall():
                k, v = row["key"], row["value"]
                if hasattr(s, k):
                    curr_val = getattr(s, k)
                    if isinstance(curr_val, bool):
                        setattr(s, k, v.lower() in ("true", "1"))
                    elif isinstance(curr_val, int):
                        try:
                            setattr(s, k, int(v))
                        except ValueError:
                            pass
                    elif isinstance(curr_val, str):
                        setattr(s, k, v)
        return s
