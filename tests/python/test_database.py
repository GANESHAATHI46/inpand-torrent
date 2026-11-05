"""Unit tests for SQLite persistence, migrations, duplicate prevention, and resume data."""

import unittest
from python.core.types import TorrentStatus, TorrentFileEntry, FilePriority, SessionSettings
from python.database.db_manager import DatabaseManager, DuplicateTorrentError


class TestDatabaseManager(unittest.TestCase):
    def setUp(self):
        # In-memory database for clean, isolated tests
        self.db = DatabaseManager(":memory:")

    def test_duplicate_detection(self):
        h = "aabbccddeeff00112233445566778899aabbccdd"
        self.assertFalse(self.db.has_torrent(h))

        self.db.add_torrent(
            info_hash=h,
            name="Ubuntu",
            total_size=5000000,
            save_path="/storage/downloads",
            status=TorrentStatus.DOWNLOADING
        )
        self.assertTrue(self.db.has_torrent(h))

        # Adding same torrent again must raise DuplicateTorrentError
        with self.assertRaises(DuplicateTorrentError):
            self.db.add_torrent(
                info_hash=h,
                name="Ubuntu Duplicate",
                total_size=5000000,
                save_path="/storage/downloads"
            )

    def test_resume_data_roundtrip(self):
        h = "1122334455667788990011223344556677889900"
        self.db.add_torrent(
            info_hash=h,
            name="ResumeTest",
            total_size=1000,
            save_path="/storage/downloads"
        )
        self.assertIsNone(self.db.get_resume_data(h))

        resume_payload = b"\x00\x01\x02\x03\xff\xfeFASTRESUME_BLOB"
        self.db.save_resume_data(h, resume_payload)

        retrieved = self.db.get_resume_data(h)
        self.assertEqual(retrieved, resume_payload)

    def test_restore_all_torrents(self):
        h1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        h2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        f1 = TorrentFileEntry(index=0, path="f1.txt", size=100, offset=0)
        self.db.add_torrent(h1, "Torrent1", 100, "/path1", files=[f1], trackers=["http://tr1.com"])
        self.db.add_torrent(h2, "Torrent2", 200, "/path2")

        all_t = self.db.get_all_torrents()
        self.assertEqual(len(all_t), 2)
        self.assertEqual(all_t[0]["info_hash"], h1)
        self.assertEqual(len(all_t[0]["files"]), 1)
        self.assertEqual(len(all_t[0]["trackers"]), 1)
        self.assertEqual(all_t[1]["info_hash"], h2)

    def test_settings_persistence(self):
        s = SessionSettings(
            download_rate_limit=500000,
            upload_rate_limit=100000,
            dht_enabled=False,
            wifi_only=True
        )
        self.db.save_settings(s)

        loaded = self.db.load_settings()
        self.assertEqual(loaded.download_rate_limit, 500000)
        self.assertEqual(loaded.upload_rate_limit, 100000)
        self.assertFalse(loaded.dht_enabled)
        self.assertTrue(loaded.wifi_only)


if __name__ == '__main__':
    unittest.main()

