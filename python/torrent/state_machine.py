"""BitTorrent state machine, transition validator, and download statistics tracker."""

import time
from typing import Optional, Dict, Any, List
from ..core.types import TorrentStatus, TorrentSnapshot, TorrentFileEntry


class StateTransitionError(Exception):
    """Raised when an illegal state transition is attempted."""
    pass


VALID_TRANSITIONS = {
    TorrentStatus.CHECKING: {TorrentStatus.DOWNLOADING, TorrentStatus.SEEDING, TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.DOWNLOADING_METADATA: {TorrentStatus.DOWNLOADING, TorrentStatus.FINISHED, TorrentStatus.SEEDING, TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.DOWNLOADING: {TorrentStatus.FINISHED, TorrentStatus.SEEDING, TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.FINISHED: {TorrentStatus.SEEDING, TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.SEEDING: {TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.CHECKING_RESUME_DATA: {TorrentStatus.DOWNLOADING, TorrentStatus.SEEDING, TorrentStatus.PAUSED, TorrentStatus.ERROR},
    TorrentStatus.PAUSED: {TorrentStatus.CHECKING, TorrentStatus.CHECKING_RESUME_DATA, TorrentStatus.DOWNLOADING_METADATA, TorrentStatus.DOWNLOADING, TorrentStatus.SEEDING, TorrentStatus.ERROR},
    TorrentStatus.ERROR: {TorrentStatus.CHECKING, TorrentStatus.PAUSED},
}


class TorrentStateMachine:
    """Manages the operational lifecycle and metrics of an individual torrent."""

    def __init__(
        self,
        info_hash: str,
        name: str,
        total_size: int,
        save_path: str,
        status: TorrentStatus = TorrentStatus.CHECKING,
        added_date: Optional[int] = None,
        piece_length: int = 0,
        num_pieces: int = 0,
        files: Optional[List[TorrentFileEntry]] = None,
    ):
        self.info_hash = info_hash.lower()
        self.name = name
        self.total_size = total_size
        self.save_path = save_path
        self.status = status
        self.added_date = added_date or int(time.time() * 1000)
        self.completed_date: Optional[int] = None
        self.piece_length = piece_length
        self.num_pieces = num_pieces
        self.files = files or []

        self.downloaded_bytes = 0
        self.uploaded_bytes = 0
        self.download_rate = 0
        self.upload_rate = 0
        self.num_seeds = 0
        self.num_peers = 0
        self.total_seeds = 0
        self.total_peers = 0
        self.pieces_progress = "0" * (num_pieces if num_pieces > 0 else 0)
        self.error_message: Optional[str] = None

        # Exponential moving average for smooth ETA
        self._last_update_time = time.time()
        self._last_downloaded = 0
        self._ema_rate = 0.0

    @property
    def progress(self) -> float:
        if self.total_size <= 0:
            return 0.0
        return min(1.0, max(0.0, self.downloaded_bytes / self.total_size))

    @property
    def eta(self) -> int:
        """Remaining time in seconds. -1 if infinite or completed."""
        if self.status in (TorrentStatus.FINISHED, TorrentStatus.SEEDING):
            return 0
        if self.download_rate <= 0 or self.total_size <= 0:
            return -1
        remaining = self.total_size - self.downloaded_bytes
        if remaining <= 0:
            return 0
        return max(1, int(remaining / self.download_rate))

    def transition_to(self, new_status: TorrentStatus, reason: Optional[str] = None) -> None:
        """Safely transition to a new operational status."""
        if self.status == new_status:
            return

        allowed = VALID_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise StateTransitionError(
                f"Cannot transition torrent {self.info_hash} from {self.status.value} to {new_status.value}"
            )

        self.status = new_status
        if new_status in (TorrentStatus.FINISHED, TorrentStatus.SEEDING) and not self.completed_date:
            self.completed_date = int(time.time() * 1000)
        if new_status == TorrentStatus.ERROR:
            self.error_message = reason or "Unknown error"
        elif new_status != TorrentStatus.ERROR:
            self.error_message = None

    def update_metrics(
        self,
        downloaded_bytes: int,
        uploaded_bytes: int,
        download_rate: int,
        upload_rate: int,
        num_seeds: int,
        num_peers: int,
        total_seeds: int = 0,
        total_peers: int = 0,
        pieces_progress: Optional[str] = None,
    ) -> None:
        """Update live download statistics from the native torrent engine."""
        self.downloaded_bytes = downloaded_bytes
        self.uploaded_bytes = uploaded_bytes
        self.download_rate = download_rate
        self.upload_rate = upload_rate
        self.num_seeds = num_seeds
        self.num_peers = num_peers
        self.total_seeds = max(num_seeds, total_seeds)
        self.total_peers = max(num_peers, total_peers)
        if pieces_progress is not None:
            self.pieces_progress = pieces_progress

        # Auto transition to finished if all bytes are downloaded
        if self.total_size > 0 and self.downloaded_bytes >= self.total_size and self.status == TorrentStatus.DOWNLOADING:
            self.transition_to(TorrentStatus.FINISHED)

    def pause(self) -> None:
        self.transition_to(TorrentStatus.PAUSED)
        self.download_rate = 0
        self.upload_rate = 0

    def resume(self) -> None:
        if self.total_size > 0 and self.downloaded_bytes >= self.total_size:
            self.transition_to(TorrentStatus.SEEDING)
        elif self.total_size == 0 and self.num_pieces == 0:
            self.transition_to(TorrentStatus.DOWNLOADING_METADATA)
        else:
            self.transition_to(TorrentStatus.DOWNLOADING)

    def mark_error(self, message: str) -> None:
        self.transition_to(TorrentStatus.ERROR, reason=message)

    def snapshot(self) -> TorrentSnapshot:
        """Create an immutable snapshot for UI dispatch or storage."""
        return TorrentSnapshot(
            info_hash=self.info_hash,
            name=self.name,
            status=self.status,
            total_size=self.total_size,
            downloaded_bytes=self.downloaded_bytes,
            uploaded_bytes=self.uploaded_bytes,
            download_rate=self.download_rate,
            upload_rate=self.upload_rate,
            progress=self.progress,
            eta=self.eta,
            num_seeds=self.num_seeds,
            num_peers=self.num_peers,
            total_seeds=self.total_seeds,
            total_peers=self.total_peers,
            save_path=self.save_path,
            added_date=self.added_date,
            completed_date=self.completed_date,
            piece_length=self.piece_length,
            num_pieces=self.num_pieces,
            pieces_progress=self.pieces_progress,
            error_message=self.error_message,
            files=list(self.files),
        )
