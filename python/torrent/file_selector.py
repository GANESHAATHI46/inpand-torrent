"""File selection, priority assignment, and piece-range mapping."""

from typing import List, Dict, Set
from ..core.types import TorrentFileEntry, FilePriority


class FileSelector:
    """Manages file selection and converts file priorities to libtorrent piece priorities."""

    def __init__(
        self,
        files: List[TorrentFileEntry],
        piece_length: int,
        num_pieces: int,
    ):
        self.files = files
        self.piece_length = piece_length
        self.num_pieces = num_pieces
        self.priorities: Dict[int, FilePriority] = {
            f.index: f.priority for f in files
        }

    def set_file_priority(self, file_index: int, priority: FilePriority) -> None:
        """Set download priority for an individual file."""
        if file_index not in self.priorities:
            raise IndexError(f"File index {file_index} not found")
        self.priorities[file_index] = priority
        for f in self.files:
            if f.index == file_index:
                f.priority = priority

    def set_all_files(self, download: bool) -> None:
        """Select or unselect all files."""
        p = FilePriority.NORMAL if download else FilePriority.DO_NOT_DOWNLOAD
        for f in self.files:
            self.priorities[f.index] = p
            f.priority = p

    @property
    def selected_size(self) -> int:
        """Total size in bytes of all files marked for download."""
        return sum(f.size for f in self.files if self.priorities.get(f.index, FilePriority.NORMAL) != FilePriority.DO_NOT_DOWNLOAD)

    def get_file_piece_range(self, file_index: int) -> range:
        """Calculate the range of pieces overlapping this file."""
        target_file = None
        for f in self.files:
            if f.index == file_index:
                target_file = f
                break
        if not target_file:
            raise IndexError(f"File {file_index} not found")

        if target_file.size == 0 or self.piece_length == 0:
            return range(0, 0)

        start_piece = target_file.offset // self.piece_length
        end_piece = (target_file.offset + target_file.size - 1) // self.piece_length
        return range(start_piece, min(self.num_pieces, end_piece + 1))

    def compute_piece_priorities(self) -> List[int]:
        """Compute the effective priority for every piece in the torrent.
        
        If a piece is shared by multiple files, it takes the maximum priority of those files.
        """
        if self.num_pieces == 0 or self.piece_length == 0:
            return []

        piece_priorities = [0] * self.num_pieces

        for f in self.files:
            p = self.priorities.get(f.index, FilePriority.NORMAL)
            p_val = int(p.value)
            if p_val == 0:
                continue

            piece_range = self.get_file_piece_range(f.index)
            for p_idx in piece_range:
                if p_val > piece_priorities[p_idx]:
                    piece_priorities[p_idx] = p_val

        return piece_priorities

