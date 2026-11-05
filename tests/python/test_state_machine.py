"""Unit tests for torrent state machine transitions, ETA calculation, and file selector."""

import unittest
from python.core.types import TorrentStatus, TorrentFileEntry, FilePriority
from python.torrent.state_machine import TorrentStateMachine, StateTransitionError
from python.torrent.file_selector import FileSelector


class TestStateMachine(unittest.TestCase):
    def test_valid_transitions(self):
        sm = TorrentStateMachine(
            info_hash="aabbccddee0011223344aabbccddee0011223344",
            name="Ubuntu",
            total_size=1000,
            save_path="/downloads",
            status=TorrentStatus.CHECKING
        )
        self.assertEqual(sm.status, TorrentStatus.CHECKING)

        sm.transition_to(TorrentStatus.DOWNLOADING)
        self.assertEqual(sm.status, TorrentStatus.DOWNLOADING)

        sm.pause()
        self.assertEqual(sm.status, TorrentStatus.PAUSED)

        sm.resume()
        self.assertEqual(sm.status, TorrentStatus.DOWNLOADING)

        sm.update_metrics(
            downloaded_bytes=1000,
            uploaded_bytes=100,
            download_rate=200,
            upload_rate=50,
            num_seeds=5,
            num_peers=10
        )
        # Should auto-transition to finished
        self.assertEqual(sm.status, TorrentStatus.FINISHED)
        self.assertEqual(sm.progress, 1.0)
        self.assertEqual(sm.eta, 0)

    def test_illegal_transition(self):
        sm = TorrentStateMachine(
            info_hash="1122334455667788990011223344556677889900",
            name="ErrorTest",
            total_size=1000,
            save_path="/downloads",
            status=TorrentStatus.FINISHED
        )
        # FINISHED cannot transition directly to DOWNLOADING_METADATA
        with self.assertRaises(StateTransitionError):
            sm.transition_to(TorrentStatus.DOWNLOADING_METADATA)

    def test_eta_calculation(self):
        sm = TorrentStateMachine(
            info_hash="2233445566778899001122334455667788990011",
            name="EtaTest",
            total_size=10000,
            save_path="/downloads",
            status=TorrentStatus.DOWNLOADING
        )
        sm.update_metrics(
            downloaded_bytes=2000,
            uploaded_bytes=0,
            download_rate=1000,
            upload_rate=0,
            num_seeds=2,
            num_peers=3
        )
        # (10000 - 2000) / 1000 = 8 seconds
        self.assertEqual(sm.eta, 8)


class TestFileSelector(unittest.TestCase):
    def setUp(self):
        self.files = [
            TorrentFileEntry(index=0, path="movie.mp4", size=1000, offset=0),
            TorrentFileEntry(index=1, path="sample.mp4", size=200, offset=1000),
            TorrentFileEntry(index=2, path="readme.txt", size=50, offset=1200),
        ]
        # Total size = 1250 bytes, piece_length = 500, total pieces = 3
        self.selector = FileSelector(self.files, piece_length=500, num_pieces=3)

    def test_piece_range_calculation(self):
        # file 0: [0..1000) -> pieces 0, 1
        r0 = self.selector.get_file_piece_range(0)
        self.assertEqual(list(r0), [0, 1])

        # file 1: [1000..1200) -> piece 2
        r1 = self.selector.get_file_piece_range(1)
        self.assertEqual(list(r1), [2])

    def test_file_priority_and_selected_size(self):
        self.assertEqual(self.selector.selected_size, 1250)

        # Unselect sample.mp4
        self.selector.set_file_priority(1, FilePriority.DO_NOT_DOWNLOAD)
        self.assertEqual(self.selector.selected_size, 1050)

        # Piece priorities: piece 2 belongs to sample (skip) and readme (normal)
        priorities = self.selector.compute_piece_priorities()
        # Piece 0 & 1 have priority 4 (normal from movie.mp4)
        self.assertEqual(priorities[0], 4)
        self.assertEqual(priorities[1], 4)
        # Piece 2 has priority 4 (from readme.txt)
        self.assertEqual(priorities[2], 4)


if __name__ == '__main__':
    unittest.main()

