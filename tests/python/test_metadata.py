"""Unit tests for bencode decoding/encoding and torrent metadata parsing."""

import hashlib
import unittest
from python.core.bencode import bencode, bdecode, BencodeError
from python.torrent.metadata import (
    create_torrent_bytes,
    parse_torrent_bytes,
    TorrentMetadataError,
)


class TestBencode(unittest.TestCase):
    def test_integers(self):
        self.assertEqual(bencode(42), b"i42e")
        self.assertEqual(bencode(-100), b"i-100e")
        self.assertEqual(bencode(0), b"i0e")
        self.assertEqual(bdecode(b"i42e"), 42)
        self.assertEqual(bdecode(b"i-100e"), -100)
        self.assertEqual(bdecode(b"i0e"), 0)

    def test_strings(self):
        self.assertEqual(bencode(b"hello"), b"5:hello")
        self.assertEqual(bencode("world"), b"5:world")
        self.assertEqual(bdecode(b"5:hello"), b"hello")

    def test_lists(self):
        encoded = bencode([1, "two", 3])
        self.assertEqual(encoded, b"li1e3:twoi3ee")
        self.assertEqual(bdecode(encoded), [1, b"two", 3])

    def test_dictionaries(self):
        d = {"b": 2, "a": 1}
        encoded = bencode(d)
        self.assertEqual(encoded, b"d1:ai1e1:bi2ee")
        self.assertEqual(bdecode(encoded), {b"a": 1, b"b": 2})

    def test_invalid_bencode(self):
        with self.assertRaises(BencodeError):
            bdecode(b"i03e")  # leading zero
        with self.assertRaises(BencodeError):
            bdecode(b"i-0e")  # negative zero
        with self.assertRaises(BencodeError):
            bdecode(b"5:bad")  # truncated string


class TestTorrentMetadata(unittest.TestCase):
    def test_single_file_torrent_roundtrip(self):
        piece_len = 16384
        fake_piece = hashlib.sha1(b"piece0_data").digest()
        raw = create_torrent_bytes(
            name="single_file.iso",
            piece_length=piece_len,
            pieces=fake_piece,
            files=[("single_file.iso", 10240)],
            announce="http://tracker.example.com/announce",
            comment="Single file test"
        )
        meta = parse_torrent_bytes(raw)
        self.assertEqual(meta.name, "single_file.iso")
        self.assertEqual(meta.total_size, 10240)
        self.assertEqual(meta.piece_length, piece_len)
        self.assertEqual(meta.num_pieces, 1)
        self.assertEqual(len(meta.files), 1)
        self.assertEqual(meta.files[0].path, "single_file.iso")
        self.assertEqual(len(meta.info_hash), 40)

    def test_multi_file_torrent_parsing(self):
        piece_len = 32768
        p1 = hashlib.sha1(b"piece0").digest()
        p2 = hashlib.sha1(b"piece1").digest()
        raw = create_torrent_bytes(
            name="AlbumRoot",
            piece_length=piece_len,
            pieces=p1 + p2,
            files=[
                ("track1.flac", 20000),
                ("track2.flac", 30000),
                ("cover.jpg", 5000),
            ],
            announce="udp://tracker.open.org:1337/announce",
            announce_list=[["udp://tracker.open.org:1337/announce"], ["http://backup.tracker.com/announce"]]
        )
        meta = parse_torrent_bytes(raw)
        self.assertEqual(meta.name, "AlbumRoot")
        self.assertEqual(meta.total_size, 55000)
        self.assertEqual(meta.num_pieces, 2)
        self.assertEqual(len(meta.files), 3)
        self.assertEqual(meta.files[0].path, "AlbumRoot/track1.flac")
        self.assertEqual(meta.files[0].offset, 0)
        self.assertEqual(meta.files[1].path, "AlbumRoot/track2.flac")
        self.assertEqual(meta.files[1].offset, 20000)
        self.assertEqual(len(meta.get_flat_trackers()), 2)

    def test_malformed_torrent(self):
        with self.assertRaises(TorrentMetadataError):
            parse_torrent_bytes(b"d4:infod12:piece lengthi16384e6:pieces5:shortee")

    def test_empty_torrent_raises(self):
        with self.assertRaises(TorrentMetadataError):
            parse_torrent_bytes(b"")
        with self.assertRaises(TorrentMetadataError):
            parse_torrent_bytes(b"short")

    def test_info_hash_exact_raw_slice(self):
        # Construct raw torrent with non-standard key ordering in info dict to verify
        # that hash is computed from the exact input slice and not re-encoded
        piece = hashlib.sha1(b"piece").digest()
        raw = b"d4:infod4:name4:test12:piece lengthi16384e6:pieces20:" + piece + b"6:lengthi100eee"
        meta = parse_torrent_bytes(raw)
        info_slice = b"d4:name4:test12:piece lengthi16384e6:pieces20:" + piece + b"6:lengthi100ee"
        expected_hash = hashlib.sha1(info_slice).hexdigest().lower()
        self.assertEqual(meta.info_hash, expected_hash)
        self.assertEqual(meta.raw_info, info_slice)


if __name__ == '__main__':
    unittest.main()

