"""Type definitions, Enums, and Dataclasses for TorrentFlow Mobile."""

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Optional, Dict, Any


class TorrentStatus(str, Enum):
    """Torrent operational states matching libtorrent state machine."""
    CHECKING = "checking"
    DOWNLOADING_METADATA = "downloading_metadata"
    DOWNLOADING = "downloading"
    FINISHED = "finished"
    SEEDING = "seeding"
    ALLOCATING = "allocating"
    CHECKING_RESUME_DATA = "checking_resume_data"
    PAUSED = "paused"
    ERROR = "error"


class FilePriority(int, Enum):
    """File download priority levels."""
    DO_NOT_DOWNLOAD = 0
    LOW = 1
    NORMAL = 4
    HIGH = 7


@dataclass
class TorrentFileEntry:
    """Represents an individual file in a multi-file or single-file torrent."""
    index: int
    path: str
    size: int
    offset: int = 0
    downloaded_bytes: int = 0
    priority: FilePriority = FilePriority.NORMAL

    @property
    def progress(self) -> float:
        if self.size == 0:
            return 1.0
        return min(1.0, max(0.0, self.downloaded_bytes / self.size))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "path": self.path,
            "size": self.size,
            "offset": self.offset,
            "downloaded_bytes": self.downloaded_bytes,
            "priority": int(self.priority.value),
            "progress": self.progress,
        }


@dataclass
class TrackerEntry:
    """Tracker URL and its connection state."""
    url: str
    tier: int = 0
    status: str = "not_contacted"
    peers: int = 0
    seeds: int = 0
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "tier": self.tier,
            "status": self.status,
            "peers": self.peers,
            "seeds": self.seeds,
            "message": self.message,
        }


@dataclass
class PeerEntry:
    """Connected BitTorrent peer information."""
    ip: str
    port: int
    client: str = ""
    download_rate: int = 0  # bytes/sec
    upload_rate: int = 0    # bytes/sec
    progress: float = 0.0
    flags: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ip": self.ip,
            "port": self.port,
            "client": self.client,
            "download_rate": self.download_rate,
            "upload_rate": self.upload_rate,
            "progress": self.progress,
            "flags": self.flags,
        }


@dataclass
class TorrentSnapshot:
    """Point-in-time snapshot of an active or stored torrent."""
    info_hash: str  # 40-char lowercase hex
    name: str
    status: TorrentStatus
    total_size: int
    downloaded_bytes: int
    uploaded_bytes: int
    download_rate: int  # bytes/sec
    upload_rate: int    # bytes/sec
    progress: float     # 0.0 to 1.0
    eta: int            # seconds remaining, -1 if unavailable
    num_seeds: int
    num_peers: int
    total_seeds: int
    total_peers: int
    save_path: str
    added_date: int     # unix timestamp ms
    completed_date: Optional[int] = None
    piece_length: int = 0
    num_pieces: int = 0
    pieces_progress: Optional[str] = None  # bitfield or hex
    error_message: Optional[str] = None
    files: List[TorrentFileEntry] = field(default_factory=list)
    trackers: List[TrackerEntry] = field(default_factory=list)
    peers: List[PeerEntry] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "info_hash": self.info_hash,
            "name": self.name,
            "status": self.status.value,
            "total_size": self.total_size,
            "downloaded_bytes": self.downloaded_bytes,
            "uploaded_bytes": self.uploaded_bytes,
            "download_rate": self.download_rate,
            "upload_rate": self.upload_rate,
            "progress": self.progress,
            "eta": self.eta,
            "num_seeds": self.num_seeds,
            "num_peers": self.num_peers,
            "total_seeds": self.total_seeds,
            "total_peers": self.total_peers,
            "save_path": self.save_path,
            "added_date": self.added_date,
            "completed_date": self.completed_date,
            "piece_length": self.piece_length,
            "num_pieces": self.num_pieces,
            "pieces_progress": self.pieces_progress,
            "error_message": self.error_message,
            "files": [f.to_dict() for f in self.files],
            "trackers": [t.to_dict() for t in self.trackers],
            "peers": [p.to_dict() for p in self.peers],
        }


@dataclass
class SessionSettings:
    """Global BitTorrent session configuration."""
    download_rate_limit: int = 0  # 0 = unlimited, in bytes/sec
    upload_rate_limit: int = 0    # 0 = unlimited, in bytes/sec
    max_active_downloads: int = 5
    max_active_uploads: int = 5
    max_connections: int = 200
    dht_enabled: bool = True
    pex_enabled: bool = True
    lsd_enabled: bool = True
    wifi_only: bool = False
    listen_port: int = 6881
    default_save_path: str = "/storage/emulated/0/Download/TorrentFlow"
    dark_mode: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "download_rate_limit": self.download_rate_limit,
            "upload_rate_limit": self.upload_rate_limit,
            "max_active_downloads": self.max_active_downloads,
            "max_active_uploads": self.max_active_uploads,
            "max_connections": self.max_connections,
            "dht_enabled": self.dht_enabled,
            "pex_enabled": self.pex_enabled,
            "lsd_enabled": self.lsd_enabled,
            "wifi_only": self.wifi_only,
            "listen_port": self.listen_port,
            "default_save_path": self.default_save_path,
            "dark_mode": self.dark_mode,
        }

