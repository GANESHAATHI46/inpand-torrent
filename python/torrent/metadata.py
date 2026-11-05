"""BitTorrent metadata parser and generator.

Extracts info-hash, files, piece hashes, trackers, and sizing from .torrent dictionaries.
"""

import hashlib
import time
from typing import Dict, List, Optional, Any, Tuple
from ..core.bencode import bdecode, bdecode_torrent, bencode, BencodeError
from ..core.types import TorrentFileEntry, FilePriority


class TorrentMetadataError(Exception):
    """Raised when torrent metadata is invalid, malformed, or corrupt."""
    pass


class TorrentMetadata:
    """Parsed BitTorrent .torrent metadata."""

    def __init__(
        self,
        info_hash: str,
        name: str,
        total_size: int,
        piece_length: int,
        pieces: bytes,
        files: List[TorrentFileEntry],
        announce: Optional[str] = None,
        announce_list: Optional[List[List[str]]] = None,
        comment: Optional[str] = None,
        created_by: Optional[str] = None,
        creation_date: Optional[int] = None,
        is_private: bool = False,
        raw_info: Optional[bytes] = None,
    ):
        self.info_hash = info_hash.lower()
        self.name = name
        self.total_size = total_size
        self.piece_length = piece_length
        self.pieces = pieces
        self.num_pieces = len(pieces) // 20
        self.files = files
        self.announce = announce or ""
        self.announce_list = announce_list or []
        self.comment = comment or ""
        self.created_by = created_by or "TorrentFlow Mobile"
        self.creation_date = creation_date or int(time.time())
        self.is_private = is_private
        self.raw_info = raw_info

    def get_piece_hash(self, index: int) -> bytes:
        """Get the 20-byte SHA1 hash of a specific piece."""
        if index < 0 or index >= self.num_pieces:
            raise IndexError(f"Piece index {index} out of bounds (0..{self.num_pieces - 1})")
        start = index * 20
        return self.pieces[start:start+20]

    def get_flat_trackers(self) -> List[str]:
        """Return a deduplicated flat list of tracker URLs."""
        urls = []
        seen = set()
        if self.announce and self.announce not in seen:
            urls.append(self.announce)
            seen.add(self.announce)
        for tier in self.announce_list:
            for url in tier:
                if url and url not in seen:
                    urls.append(url)
                    seen.add(url)
        return urls

    def to_dict(self) -> Dict[str, Any]:
        return {
            "info_hash": self.info_hash,
            "name": self.name,
            "total_size": self.total_size,
            "piece_length": self.piece_length,
            "num_pieces": self.num_pieces,
            "is_private": self.is_private,
            "announce": self.announce,
            "announce_list": self.announce_list,
            "comment": self.comment,
            "created_by": self.created_by,
            "creation_date": self.creation_date,
            "files": [f.to_dict() for f in self.files],
        }


def parse_torrent_bytes(torrent_data: bytes) -> TorrentMetadata:
    """Parse raw bytes of a .torrent file into a TorrentMetadata instance."""
    if not torrent_data or len(torrent_data) < 20:
        raise TorrentMetadataError("Torrent file is empty or too short (minimum 20 bytes)")

    if len(torrent_data) > 50 * 1024 * 1024:
        raise TorrentMetadataError("Torrent file exceeds maximum allowed size of 50MB")

    try:
        decoded, raw_info = bdecode_torrent(torrent_data)
    except BencodeError as e:
        raise TorrentMetadataError(f"Failed to bdecode torrent file: {e}")

    # The canonical SHA1 hash of the bencoded 'info' dictionary is the BitTorrent info-hash
    # Computed from the exact original bencoded info dictionary byte range without re-encoding
    info_hash = hashlib.sha1(raw_info).hexdigest().lower()

    # Locate info dictionary
    info_dict = None
    for k, v in decoded.items():
        k_str = k.decode('utf-8', errors='ignore') if isinstance(k, bytes) else str(k)
        if k_str == "info":
            info_dict = v
            break

    if info_dict is None or not isinstance(info_dict, dict):
        raise TorrentMetadataError("Missing or invalid 'info' dictionary in torrent file")

    # Helper to get string/bytes from dict
    def get_val(d: dict, key: str, default: Any = None) -> Any:
        for k, v in d.items():
            k_s = k.decode('utf-8', errors='ignore') if isinstance(k, bytes) else str(k)
            if k_s == key:
                return v
        return default

    # Extract name
    name_raw = get_val(info_dict, "name", b"Unnamed")
    name = name_raw.decode('utf-8', errors='replace') if isinstance(name_raw, bytes) else str(name_raw)

    # Extract piece length and pieces
    piece_length = get_val(info_dict, "piece length")
    if not isinstance(piece_length, int) or piece_length <= 0:
        raise TorrentMetadataError("Invalid or missing 'piece length'")

    pieces = get_val(info_dict, "pieces")
    if not isinstance(pieces, (bytes, bytearray)) or len(pieces) % 20 != 0:
        raise TorrentMetadataError("Invalid 'pieces' binary hash block (must be a multiple of 20 bytes)")

    # Extract files: can be single-file or multi-file
    files: List[TorrentFileEntry] = []
    files_list = get_val(info_dict, "files")

    if files_list is not None and isinstance(files_list, list):
        # Multi-file layout
        total_size = 0
        curr_offset = 0
        for idx, f in enumerate(files_list):
            if not isinstance(f, dict):
                continue
            length = get_val(f, "length", 0)
            if not isinstance(length, int) or length < 0:
                continue
            path_parts = get_val(f, "path", [])
            path_str_parts = []
            for p in path_parts:
                part_s = p.decode('utf-8', errors='replace') if isinstance(p, bytes) else str(p)
                path_str_parts.append(part_s)
            file_rel_path = "/".join(path_str_parts) if path_str_parts else f"file_{idx}"
            full_path = f"{name}/{file_rel_path}"

            files.append(TorrentFileEntry(
                index=idx,
                path=full_path,
                size=length,
                offset=curr_offset,
                priority=FilePriority.NORMAL
            ))
            curr_offset += length
            total_size += length
    else:
        # Single file layout
        length = get_val(info_dict, "length")
        if not isinstance(length, int) or length < 0:
            raise TorrentMetadataError("Single-file torrent missing valid 'length'")
        total_size = length
        files.append(TorrentFileEntry(
            index=0,
            path=name,
            size=total_size,
            offset=0,
            priority=FilePriority.NORMAL
        ))

    # Extract trackers
    announce_raw = get_val(decoded, "announce")
    announce = announce_raw.decode('utf-8', errors='ignore') if isinstance(announce_raw, bytes) else str(announce_raw or "")

    announce_list_raw = get_val(decoded, "announce-list")
    announce_list: List[List[str]] = []
    if announce_list_raw and isinstance(announce_list_raw, list):
        for tier in announce_list_raw:
            if isinstance(tier, list):
                tier_urls = []
                for u in tier:
                    u_s = u.decode('utf-8', errors='ignore') if isinstance(u, bytes) else str(u)
                    if u_s:
                        tier_urls.append(u_s)
                if tier_urls:
                    announce_list.append(tier_urls)

    # Optional metadata
    comment_raw = get_val(decoded, "comment")
    comment = comment_raw.decode('utf-8', errors='ignore') if isinstance(comment_raw, bytes) else str(comment_raw or "")

    created_by_raw = get_val(decoded, "created by")
    created_by = created_by_raw.decode('utf-8', errors='ignore') if isinstance(created_by_raw, bytes) else str(created_by_raw or "")

    creation_date = get_val(decoded, "creation date")
    if not isinstance(creation_date, int):
        creation_date = int(time.time())

    is_private_val = get_val(info_dict, "private", 0)
    is_private = bool(is_private_val == 1)

    return TorrentMetadata(
        info_hash=info_hash,
        name=name,
        total_size=total_size,
        piece_length=piece_length,
        pieces=bytes(pieces),
        files=files,
        announce=announce,
        announce_list=announce_list,
        comment=comment,
        created_by=created_by,
        creation_date=creation_date,
        is_private=is_private,
        raw_info=raw_info,
    )


def create_torrent_bytes(
    name: str,
    piece_length: int,
    pieces: bytes,
    files: List[Tuple[str, int]],  # (relative_path, length)
    announce: str,
    announce_list: Optional[List[List[str]]] = None,
    comment: str = "Created by TorrentFlow Mobile",
    created_by: str = "TorrentFlow Mobile 1.0",
) -> bytes:
    """Create raw .torrent bytes for testing or exporting."""
    if len(files) == 1 and files[0][0] == name:
        # Single file
        info: Dict[str, Any] = {
            "name": name,
            "piece length": piece_length,
            "pieces": pieces,
            "length": files[0][1],
        }
    else:
        # Multi file
        file_entries = []
        for path, length in files:
            parts = [p for p in path.split("/") if p]
            file_entries.append({"length": length, "path": parts})
        info = {
            "name": name,
            "piece length": piece_length,
            "pieces": pieces,
            "files": file_entries,
        }

    meta: Dict[str, Any] = {
        "info": info,
        "announce": announce,
        "comment": comment,
        "created by": created_by,
        "creation date": int(time.time()),
    }
    if announce_list:
        meta["announce-list"] = announce_list

    return bencode(meta)

