"""BitTorrent Session Manager orchestrating database persistence, active queue, and native engine interaction."""

import os
from typing import Dict, List, Optional, Any
from ..core.types import TorrentStatus, TorrentSnapshot, SessionSettings, FilePriority
from ..core.magnet import parse_magnet_uri, MagnetURI
from ..torrent.metadata import parse_torrent_bytes, TorrentMetadata
from ..torrent.state_machine import TorrentStateMachine
from ..database.db_manager import DatabaseManager, DuplicateTorrentError
from .bridge_protocol import BridgeAction, BridgeAlert, BridgeMessage


class SessionManager:
    """Central session orchestrator for TorrentFlow Mobile."""

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db = db_manager or DatabaseManager()
        self.settings: SessionSettings = self.db.load_settings()
        self.torrents: Dict[str, TorrentStateMachine] = {}
        self.restore_session()

    def restore_session(self) -> None:
        """Load persisted torrents from SQLite and instantiate state machines."""
        records = self.db.get_all_torrents()
        for rec in records:
            info_hash = rec["info_hash"].lower()
            status = TorrentStatus(rec["status"]) if rec["status"] in TorrentStatus._value2member_map_ else TorrentStatus.PAUSED
            # If the app crashed while downloading, mark paused or checking
            if status == TorrentStatus.DOWNLOADING:
                status = TorrentStatus.CHECKING_RESUME_DATA

            sm = TorrentStateMachine(
                info_hash=info_hash,
                name=rec["name"],
                total_size=rec["total_size"],
                save_path=rec["save_path"],
                status=status,
                added_date=rec["added_date"],
                piece_length=rec["piece_length"],
                num_pieces=rec["num_pieces"],
            )
            sm.downloaded_bytes = rec["downloaded_bytes"]
            sm.uploaded_bytes = rec["uploaded_bytes"]
            sm.error_message = rec["error_message"]
            self.torrents[info_hash] = sm

    def add_magnet(self, magnet_str: str, custom_save_path: Optional[str] = None) -> TorrentSnapshot:
        """Parse magnet, check duplicates, save to DB, and initialize state machine."""
        parsed: MagnetURI = parse_magnet_uri(magnet_str)
        info_hash = parsed.info_hash

        if self.db.has_torrent(info_hash):
            raise DuplicateTorrentError(f"Torrent with hash {info_hash} is already in download queue")

        save_path = custom_save_path or self.settings.default_save_path
        name = parsed.name or f"Magnet_{info_hash[:8]}"

        self.db.add_torrent(
            info_hash=info_hash,
            name=name,
            total_size=parsed.exact_length or 0,
            save_path=save_path,
            status=TorrentStatus.DOWNLOADING_METADATA,
            trackers=parsed.trackers,
        )

        sm = TorrentStateMachine(
            info_hash=info_hash,
            name=name,
            total_size=parsed.exact_length or 0,
            save_path=save_path,
            status=TorrentStatus.DOWNLOADING_METADATA,
        )
        self.torrents[info_hash] = sm
        return sm.snapshot()

    def add_torrent_file(self, file_bytes: bytes, custom_save_path: Optional[str] = None) -> TorrentSnapshot:
        """Parse .torrent bytes, extract metadata, persist to DB, and initialize state machine."""
        meta: TorrentMetadata = parse_torrent_bytes(file_bytes)
        info_hash = meta.info_hash

        if self.db.has_torrent(info_hash):
            raise DuplicateTorrentError(f"Torrent with hash {info_hash} is already in download queue")

        save_path = custom_save_path or self.settings.default_save_path

        self.db.add_torrent(
            info_hash=info_hash,
            name=meta.name,
            total_size=meta.total_size,
            save_path=save_path,
            piece_length=meta.piece_length,
            num_pieces=meta.num_pieces,
            status=TorrentStatus.DOWNLOADING,
            files=meta.files,
            trackers=meta.get_flat_trackers(),
        )

        sm = TorrentStateMachine(
            info_hash=info_hash,
            name=meta.name,
            total_size=meta.total_size,
            save_path=save_path,
            piece_length=meta.piece_length,
            num_pieces=meta.num_pieces,
            status=TorrentStatus.DOWNLOADING,
            files=meta.files,
        )
        self.torrents[info_hash] = sm
        return sm.snapshot()

    def pause_torrent(self, info_hash: str) -> None:
        hash_l = info_hash.lower()
        if hash_l in self.torrents:
            self.torrents[hash_l].pause()
            self.db.update_torrent_status(hash_l, TorrentStatus.PAUSED)

    def resume_torrent(self, info_hash: str) -> None:
        hash_l = info_hash.lower()
        if hash_l in self.torrents:
            self.torrents[hash_l].resume()
            self.db.update_torrent_status(hash_l, self.torrents[hash_l].status)

    def remove_torrent(self, info_hash: str, delete_files: bool = False) -> None:
        hash_l = info_hash.lower()
        if hash_l in self.torrents:
            target = self.torrents.pop(hash_l)
            self.db.remove_torrent(hash_l)
            if delete_files and target.save_path:
                try:
                    canonical_base = os.path.realpath(target.save_path)
                    full_target_path = os.path.realpath(os.path.join(target.save_path, target.name))
                    # Prevent directory traversal attacks
                    if (full_target_path.startswith(canonical_base + os.sep) or full_target_path == canonical_base):
                        # Safeguard against root directory deletion
                        if full_target_path not in ("/", "/storage/emulated/0", "/sdcard", "C:\\", "D:\\"):
                            if os.path.isdir(full_target_path):
                                import shutil
                                shutil.rmtree(full_target_path, ignore_errors=True)
                            elif os.path.isfile(full_target_path):
                                os.remove(full_target_path)
                except Exception:
                    pass

    def pause_all(self) -> None:
        for sm in self.torrents.values():
            if sm.status in (TorrentStatus.DOWNLOADING, TorrentStatus.DOWNLOADING_METADATA, TorrentStatus.CHECKING):
                sm.pause()
                self.db.update_torrent_status(sm.info_hash, TorrentStatus.PAUSED)

    def resume_all(self) -> None:
        for sm in self.torrents.values():
            if sm.status == TorrentStatus.PAUSED:
                sm.resume()
                self.db.update_torrent_status(sm.info_hash, sm.status)

    def set_speed_limits(self, download_limit: int, upload_limit: int) -> None:
        self.settings.download_rate_limit = download_limit
        self.settings.upload_rate_limit = upload_limit
        self.db.save_settings(self.settings)

    def handle_native_alert(self, alert_type: str, payload: Dict[str, Any]) -> None:
        """Process event callback received from native C++ libtorrent engine."""
        info_hash = payload.get("info_hash", "").lower()
        sm = self.torrents.get(info_hash)

        if alert_type == BridgeAlert.STATE_UPDATE.value and sm:
            sm.update_metrics(
                downloaded_bytes=payload.get("downloaded_bytes", sm.downloaded_bytes),
                uploaded_bytes=payload.get("uploaded_bytes", sm.uploaded_bytes),
                download_rate=payload.get("download_rate", 0),
                upload_rate=payload.get("upload_rate", 0),
                num_seeds=payload.get("num_seeds", 0),
                num_peers=payload.get("num_peers", 0),
                total_seeds=payload.get("total_seeds", 0),
                total_peers=payload.get("total_peers", 0),
                pieces_progress=payload.get("pieces_progress"),
            )
            self.db.update_torrent_progress(
                info_hash=info_hash,
                downloaded_bytes=sm.downloaded_bytes,
                uploaded_bytes=sm.uploaded_bytes,
                completed_date=sm.completed_date,
            )

        elif alert_type == BridgeAlert.TORRENT_FINISHED.value and sm:
            sm.transition_to(TorrentStatus.FINISHED)
            self.db.update_torrent_status(info_hash, TorrentStatus.FINISHED)

        elif alert_type == BridgeAlert.SAVE_RESUME_DATA.value:
            resume_hex = payload.get("resume_data_hex")
            if resume_hex and info_hash:
                resume_bytes = bytes.fromhex(resume_hex)
                self.db.save_resume_data(info_hash, resume_bytes)

        elif alert_type == BridgeAlert.TORRENT_ERROR.value and sm:
            err = payload.get("error_message", "Unknown error")
            sm.mark_error(err)
            self.db.update_torrent_status(info_hash, TorrentStatus.ERROR, error_message=err)

    def get_dashboard_stats(self) -> Dict[str, Any]:
        """Aggregate real-time metrics across all managed torrents."""
        total_dl_rate = sum(t.download_rate for t in self.torrents.values())
        total_ul_rate = sum(t.upload_rate for t in self.torrents.values())
        total_size = sum(t.total_size for t in self.torrents.values())
        total_downloaded = sum(t.downloaded_bytes for t in self.torrents.values())

        overall_progress = (total_downloaded / total_size) if total_size > 0 else 0.0

        active_count = sum(1 for t in self.torrents.values() if t.status in (TorrentStatus.DOWNLOADING, TorrentStatus.DOWNLOADING_METADATA))
        completed_count = sum(1 for t in self.torrents.values() if t.status in (TorrentStatus.FINISHED, TorrentStatus.SEEDING))
        paused_count = sum(1 for t in self.torrents.values() if t.status == TorrentStatus.PAUSED)

        return {
            "total_torrents": len(self.torrents),
            "active_downloads": active_count,
            "completed_downloads": completed_count,
            "paused_downloads": paused_count,
            "download_speed": total_dl_rate,
            "upload_speed": total_ul_rate,
            "overall_progress": overall_progress,
            "total_size": total_size,
            "total_downloaded": total_downloaded,
        }

    def get_all_snapshots(self) -> List[Dict[str, Any]]:
        return [t.snapshot().to_dict() for t in self.torrents.values()]

