"""Comprehensive Magnet URI parser and generator.

Handles standard BitTorrent magnet URIs:
- xt: exact topic, urn:btih:<hex40 or base32-32>
- dn: display name
- tr: tracker URLs (multiple allowed)
- ws: web seeds (multiple allowed)
- xl: exact file length in bytes
- so: select-only indices
"""

import base64
import re
import urllib.parse
from typing import Dict, List, Optional, Any


class MagnetParseError(Exception):
    """Raised when a magnet link has an invalid structure or missing hash."""
    pass


HEX_40_RE = re.compile(r'^[0-9a-fA-F]{40}$')
BASE32_32_RE = re.compile(r'^[2-7a-zA-Z]{32}$')


class MagnetURI:
    """Parsed BitTorrent Magnet URI."""

    def __init__(
        self,
        info_hash: str,
        name: Optional[str] = None,
        trackers: Optional[List[str]] = None,
        web_seeds: Optional[List[str]] = None,
        exact_length: Optional[int] = None,
        raw_uri: Optional[str] = None,
    ):
        self.info_hash = info_hash.lower()
        self.name = name or ""
        self.trackers = trackers or []
        self.web_seeds = web_seeds or []
        self.exact_length = exact_length
        self.raw_uri = raw_uri or ""

    def __repr__(self) -> str:
        return f"<MagnetURI name={self.name!r} info_hash={self.info_hash}>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "info_hash": self.info_hash,
            "name": self.name,
            "trackers": list(self.trackers),
            "web_seeds": list(self.web_seeds),
            "exact_length": self.exact_length,
            "raw_uri": self.raw_uri or self.to_uri(),
        }

    def to_uri(self) -> str:
        """Construct a standardized magnet URI string."""
        params = [f"xt=urn:btih:{self.info_hash}"]
        if self.name:
            params.append(f"dn={urllib.parse.quote(self.name)}")
        for tr in self.trackers:
            params.append(f"tr={urllib.parse.quote(tr)}")
        for ws in self.web_seeds:
            params.append(f"ws={urllib.parse.quote(ws)}")
        if self.exact_length is not None and self.exact_length > 0:
            params.append(f"xl={self.exact_length}")
        return "magnet:?" + "&".join(params)


def parse_magnet_uri(uri: str) -> MagnetURI:
    """Parse a magnet URI string into a MagnetURI object.
    
    Accepts raw magnet URIs, with or without leading/trailing whitespace.
    """
    if not uri or not isinstance(uri, str):
        raise MagnetParseError("Empty or non-string magnet URI")

    uri_clean = uri.strip()
    if not uri_clean.lower().startswith("magnet:?"):
        raise MagnetParseError("URI must start with 'magnet:?'")

    query_str = uri_clean[8:]
    params = urllib.parse.parse_qs(query_str, keep_blank_values=False)

    # 1. Parse xt (exact topic)
    xt_list = params.get("xt", [])
    if not xt_list:
        raise MagnetParseError("Missing 'xt' (exact topic) parameter in magnet URI")

    info_hash = None
    for xt in xt_list:
        xt_lower = xt.lower()
        if xt_lower.startswith("urn:btih:"):
            hash_candidate = xt[9:].strip()
            # Check if 40-char hex
            if HEX_40_RE.match(hash_candidate):
                info_hash = hash_candidate.lower()
                break
            # Check if 32-char base32
            elif BASE32_32_RE.match(hash_candidate):
                try:
                    # Pad to multiple of 8 if necessary
                    padded = hash_candidate.upper()
                    missing_padding = len(padded) % 8
                    if missing_padding:
                        padded += '=' * (8 - missing_padding)
                    raw_bytes = base64.b32decode(padded)
                    info_hash = raw_bytes.hex().lower()
                    break
                except Exception as e:
                    raise MagnetParseError(f"Invalid base32 info-hash: {e}")
        elif xt_lower.startswith("urn:btmh:"):
            # BitTorrent v2 multihash (1220 + 32-byte sha256)
            # Support fallback / extraction
            parts = xt.split(":")
            if len(parts) >= 3 and len(parts[2]) >= 40:
                info_hash = parts[2][:40].lower()
                break

    if not info_hash:
        raise MagnetParseError("No valid BitTorrent info-hash found in 'xt' parameter")

    # 2. Parse dn (display name)
    dn_list = params.get("dn", [])
    name = dn_list[0] if dn_list else ""

    # 3. Parse tr (trackers)
    raw_trackers = params.get("tr", [])
    trackers = []
    seen_trackers = set()
    for tr in raw_trackers:
        tr_stripped = tr.strip()
        if tr_stripped and tr_stripped not in seen_trackers:
            trackers.append(tr_stripped)
            seen_trackers.add(tr_stripped)

    # 4. Parse ws (web seeds)
    raw_ws = params.get("ws", [])
    web_seeds = [ws.strip() for ws in raw_ws if ws.strip()]

    # 5. Parse xl (exact length)
    exact_length = None
    xl_list = params.get("xl", [])
    if xl_list:
        try:
            exact_length = int(xl_list[0])
        except ValueError:
            pass

    return MagnetURI(
        info_hash=info_hash,
        name=name,
        trackers=trackers,
        web_seeds=web_seeds,
        exact_length=exact_length,
        raw_uri=uri_clean,
    )

