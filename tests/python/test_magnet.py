"""Unit tests for Magnet URI parsing, encoding, and validation."""

import unittest
from python.core.magnet import parse_magnet_uri, MagnetParseError, MagnetURI


class TestMagnetParsing(unittest.TestCase):
    def test_standard_hex_magnet(self):
        uri = (
            "magnet:?xt=urn:btih:d540fc48eb12f2833163eed6421d449dd8f1ce1f"
            "&dn=Ubuntu-24.04-desktop-amd64.iso"
            "&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce"
            "&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"
            "&xl=6078693376"
        )
        parsed = parse_magnet_uri(uri)
        self.assertEqual(parsed.info_hash, "d540fc48eb12f2833163eed6421d449dd8f1ce1f")
        self.assertEqual(parsed.name, "Ubuntu-24.04-desktop-amd64.iso")
        self.assertEqual(len(parsed.trackers), 2)
        self.assertEqual(parsed.trackers[0], "https://torrent.ubuntu.com/announce")
        self.assertEqual(parsed.exact_length, 6078693376)

    def test_base32_magnet(self):
        # 32-character base32 hash for 20 bytes: 40-char hex equivalent
        # Example 32-char base32 string: 234567QWERTYUIOPASDFGHJKLZXCVBNM
        raw_hash = b"\x01\x23\x45\x67\x89\xab\xcd\xef\x01\x23\x45\x67\x89\xab\xcd\xef\x01\x23\x45\x67"
        expected_hex = raw_hash.hex().lower()
        import base64
        b32_str = base64.b32encode(raw_hash).decode('ascii').rstrip('=')

        uri = f"magnet:?xt=urn:btih:{b32_str}&dn=TestBase32"
        parsed = parse_magnet_uri(uri)
        self.assertEqual(parsed.info_hash, expected_hex)
        self.assertEqual(parsed.name, "TestBase32")

    def test_invalid_magnet_missing_xt(self):
        with self.assertRaises(MagnetParseError):
            parse_magnet_uri("magnet:?dn=TestWithoutHash")

    def test_invalid_magnet_prefix(self):
        with self.assertRaises(MagnetParseError):
            parse_magnet_uri("http://example.com/not-a-magnet")

    def test_to_uri_reconstruction(self):
        mag = MagnetURI(
            info_hash="aabbccddeeff00112233445566778899aabbccdd",
            name="Sample Torrent",
            trackers=["udp://tracker.open.org:6969/announce"]
        )
        uri = mag.to_uri()
        self.assertIn("xt=urn:btih:aabbccddeeff00112233445566778899aabbccdd", uri)
        self.assertIn("dn=Sample%20Torrent", uri)


if __name__ == '__main__':
    unittest.main()

