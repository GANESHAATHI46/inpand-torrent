"""Bridge Protocol specification and message serialization.

Defines standardized JSON command actions and alert events between UI/Python and Native Android C++ libtorrent.
"""

import json
from enum import Enum
from typing import Dict, Any, Optional


class BridgeAction(str, Enum):
    """Commands sent from application layer to native engine."""
    SESSION_INIT = "session_init"
    SESSION_UPDATE_SETTINGS = "session_update_settings"
    ADD_TORRENT_MAGNET = "add_torrent_magnet"
    ADD_TORRENT_METADATA = "add_torrent_metadata"
    PAUSE_TORRENT = "pause_torrent"
    RESUME_TORRENT = "resume_torrent"
    REMOVE_TORRENT = "remove_torrent"
    SET_FILE_PRIORITY = "set_file_priority"
    PAUSE_ALL = "pause_all"
    RESUME_ALL = "resume_all"
    FORCE_RECHECK = "force_recheck"
    SET_SPEED_LIMITS = "set_speed_limits"


class BridgeAlert(str, Enum):
    """Alerts dispatched from native engine to application layer."""
    TORRENT_ADDED = "torrent_added"
    METADATA_RECEIVED = "metadata_received"
    STATE_UPDATE = "state_update"
    TORRENT_FINISHED = "torrent_finished"
    TORRENT_PAUSED = "torrent_paused"
    TORRENT_RESUMED = "torrent_resumed"
    TORRENT_REMOVED = "torrent_removed"
    SAVE_RESUME_DATA = "save_resume_data"
    FASTRESUME_REJECTED = "fastresume_rejected"
    TORRENT_ERROR = "torrent_error"
    STORAGE_MOVED = "storage_moved"
    TRACKER_ANNOUNCE = "tracker_announce"
    PEER_CONNECTED = "peer_connected"
    PEER_DISCONNECTED = "peer_disconnected"


class BridgeMessage:
    """Encapsulates a bridge command or alert."""

    @staticmethod
    def create_command(action: BridgeAction, payload: Optional[Dict[str, Any]] = None) -> str:
        msg = {
            "type": "command",
            "action": action.value,
            "payload": payload or {}
        }
        return json.dumps(msg)

    @staticmethod
    def parse_message(raw_json: str) -> Dict[str, Any]:
        try:
            parsed = json.loads(raw_json)
            if not isinstance(parsed, dict) or "action" not in parsed:
                raise ValueError("Invalid message format: missing action")
            return parsed
        except Exception as e:
            raise ValueError(f"Failed to parse bridge JSON: {e}")

