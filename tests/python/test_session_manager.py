"""Unit tests for SessionManager, bridge protocol, pause/resume, and dashboard stats."""

import unittest
from python.core.types import TorrentStatus
from python.database.db_manager import DatabaseManager
from python.services.session_manager import SessionManager
from python.services.bridge_protocol import BridgeAlert, BridgeAction, BridgeMessage


class TestSessionManager(unittest.TestCase):
    def setUp(self):
        self.db = DatabaseManager(":memory:")
        self.session = SessionManager(self.db)

    def test_add_magnet_and_dashboard_stats(self):
        magnet = "magnet:?xt=urn:btih:d540fc48eb12f2833163eed6421d449dd8f1ce1f&dn=UbuntuISO&xl=2000000000"
        snapshot = self.session.add_magnet(magnet)

        self.assertEqual(snapshot.info_hash, "d540fc48eb12f2833163eed6421d449dd8f1ce1f")
        self.assertEqual(snapshot.name, "UbuntuISO")
        self.assertEqual(snapshot.status, TorrentStatus.DOWNLOADING_METADATA)

        stats = self.session.get_dashboard_stats()
        self.assertEqual(stats["total_torrents"], 1)
        self.assertEqual(stats["active_downloads"], 1)
        self.assertEqual(stats["completed_downloads"], 0)

    def test_pause_resume_lifecycle(self):
        magnet = "magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=TestTorrent"
        self.session.add_magnet(magnet)
        h = "1111111111111111111111111111111111111111"

        self.session.pause_torrent(h)
        self.assertEqual(self.session.torrents[h].status, TorrentStatus.PAUSED)
        self.assertEqual(self.session.get_dashboard_stats()["paused_downloads"], 1)

        self.session.resume_torrent(h)
        self.assertEqual(self.session.torrents[h].status, TorrentStatus.DOWNLOADING_METADATA)

    def test_native_alert_handling(self):
        magnet = "magnet:?xt=urn:btih:2222222222222222222222222222222222222222&dn=AlertTest&xl=1000"
        self.session.add_magnet(magnet)
        h = "2222222222222222222222222222222222222222"

        # Simulate engine progress alert
        self.session.handle_native_alert(
            BridgeAlert.STATE_UPDATE.value,
            {
                "info_hash": h,
                "downloaded_bytes": 500,
                "uploaded_bytes": 50,
                "download_rate": 100,
                "upload_rate": 10,
                "num_seeds": 4,
                "num_peers": 8,
            }
        )
        sm = self.session.torrents[h]
        self.assertEqual(sm.downloaded_bytes, 500)
        self.assertEqual(sm.download_rate, 100)
        self.assertEqual(sm.num_seeds, 4)

        # Simulate finish alert
        self.session.handle_native_alert(
            BridgeAlert.TORRENT_FINISHED.value,
            {"info_hash": h}
        )
        self.assertEqual(sm.status, TorrentStatus.FINISHED)
        self.assertEqual(self.session.get_dashboard_stats()["completed_downloads"], 1)

    def test_bridge_protocol_serialization(self):
        cmd = BridgeMessage.create_command(
            BridgeAction.ADD_TORRENT_MAGNET,
            {"uri": "magnet:?xt=urn:btih:3333333333333333333333333333333333333333"}
        )
        parsed = BridgeMessage.parse_message(cmd)
        self.assertEqual(parsed["action"], "add_torrent_magnet")
        self.assertIn("3333333333333333333333333333333333333333", parsed["payload"]["uri"])

    def test_remove_torrent_mode_a_keep_files(self):
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as tmpdir:
            magnet = "magnet:?xt=urn:btih:4444444444444444444444444444444444444444&dn=KeepMe"
            self.session.add_magnet(magnet, custom_save_path=tmpdir)
            h = "4444444444444444444444444444444444444444"

            # Create dummy payload file
            file_path = os.path.join(tmpdir, "KeepMe")
            with open(file_path, "w") as f:
                f.write("important data")

            self.session.remove_torrent(h, delete_files=False)
            self.assertNotIn(h, self.session.torrents)
            self.assertFalse(self.db.has_torrent(h))
            self.assertTrue(os.path.exists(file_path))  # File preserved in Mode A

    def test_remove_torrent_mode_b_delete_files(self):
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as tmpdir:
            magnet = "magnet:?xt=urn:btih:5555555555555555555555555555555555555555&dn=DeleteMe"
            self.session.add_magnet(magnet, custom_save_path=tmpdir)
            h = "5555555555555555555555555555555555555555"

            # Create dummy payload file
            file_path = os.path.join(tmpdir, "DeleteMe")
            with open(file_path, "w") as f:
                f.write("discardable data")

            self.session.remove_torrent(h, delete_files=True)
            self.assertNotIn(h, self.session.torrents)
            self.assertFalse(self.db.has_torrent(h))
            self.assertFalse(os.path.exists(file_path))  # File safely deleted in Mode B

    def test_remove_torrent_path_traversal_protection(self):
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as tmpdir:
            secret_file = os.path.join(tmpdir, "do_not_delete.txt")
            with open(secret_file, "w") as f:
                f.write("secret")

            sub_dir = os.path.join(tmpdir, "downloads")
            os.makedirs(sub_dir, exist_ok=True)

            # Malicious torrent trying to traverse out of save_path
            magnet = "magnet:?xt=urn:btih:6666666666666666666666666666666666666666&dn=../do_not_delete.txt"
            self.session.add_magnet(magnet, custom_save_path=sub_dir)
            h = "6666666666666666666666666666666666666666"

            self.session.remove_torrent(h, delete_files=True)
            # The secret file must NOT be deleted!
            self.assertTrue(os.path.exists(secret_file))


if __name__ == '__main__':
    unittest.main()

