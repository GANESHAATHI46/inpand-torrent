# Testing Suite and Verification Procedures

This document details all test suites, verification commands, and physical hardware validation steps for **TorrentFlow Mobile**.

---

## 1. Automated Test Suites

### A. TypeScript Type Check
Verifies static typing, navigation parameters, props, and theme integrity across all Expo Router screens:
```bash
npm run typecheck
```
**Status**: 0 errors.

### B. JavaScript / TypeScript Unit Tests (Jest)
Runs unit tests for utility functions, byte sizing, speed calculations, status label formatting, and pure TypeScript .torrent bencode parsing:
```bash
npm test
```
**Coverage**:
- `formatBytes`: 0 bytes, negative handling, standard units (B, KB, MB, GB).
- `formatSpeed`: Transfer rates per second.
- `formatEta`: Infinite representation, completion states, duration formatting.
- `formatStatusLabel`: Human-readable status mapping.
- `torrentParser`: BEP 3 compliant bencode parsing, exact raw info-hash calculation from unadulterated buffer slices, single-file and multi-file tree layouts, piece boundary validation, tracker tier extraction, and FIPS 180-1 SHA-1 test vectors.
**Status**: 14 tests passing (100% pass rate).

### C. Python Core Engine Tests
Runs 28 comprehensive unit tests validating core BitTorrent specifications, info-hash raw slice integrity, and SQLite persistence:
```bash
python -m unittest discover -s tests/python -p "test_*.py"
```

**Test Coverage Summary**:
1. `tests/python/test_magnet.py`:
   - 40-character hexadecimal info-hash parsing.
   - 32-character base32 RFC 4648 info-hash decoding to 20-byte SHA-1.
   - Multi-tracker array parsing and deduplication.
   - Exact length (`xl`) extraction.
   - Reconstructing canonical magnet URIs.
2. `tests/python/test_metadata.py`:
   - Bencoding and bdecoding primitives (integers, strings, lists, lexicographically sorted dicts).
   - Single-file `.torrent` generation and parsing.
   - Multi-file directory hierarchy extraction and offset mapping.
   - SHA-1 info-hash canonical calculation.
   - Malformed / truncated data rejection.
3. `tests/python/test_state_machine.py`:
   - Valid lifecycle state transitions.
   - Prevention of illegal state transitions (e.g. `FINISHED` -> `DOWNLOADING_METADATA`).
   - Moving-average ETA estimation.
4. `tests/python/test_file_selector.py`:
   - Piece range calculation overlapping file boundaries.
   - File priority assignment (Skip, Normal, High).
   - Priority propagation to piece bitmasks.
5. `tests/python/test_database.py`:
   - Schema creation and versioned migration runner.
   - Duplicate torrent detection.
   - Resume data BLOB serialization and retrieval.
   - Full session restoration across restarts.
   - Preference persistence.
6. `tests/python/test_session_manager.py`:
   - Aggregate dashboard metrics (total download rate, active/completed counts).
   - Pause / resume lifecycle management.
   - Native alert event handling.
   - Bridge protocol serialization.

---

## 2. Physical Android Device Testing Procedure

To test actual BitTorrent peer-to-peer downloading:

### Test Case 1: Lawful Torrent Transfer (Ubuntu Netboot ISO)
1. Launch **TorrentFlow Mobile** on a physical Android device.
2. Tap **Add** on the Dashboard or Downloads screen.
3. Paste the official Ubuntu 24.04 netboot / desktop magnet URI:
   ```
   magnet:?xt=urn:btih:d540fc48eb12f2833163eed6421d449dd8f1ce1f&dn=Ubuntu-Desktop&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce
   ```
4. Verify:
   - Initial state: `Fetching Metadata`.
   - Metadata received: Displays full file tree and total size.
   - Transition to `Downloading`.
   - Speeds, seed counts, and peer counts reflect real BitTorrent swarm activity.

### Test Case 2: Background Foreground Service Execution
1. With active downloads in progress, press the Android **Home** button or lock the screen.
2. Verify:
   - Persistent notification appears with real-time download speed.
   - Transfer speeds remain active after 10+ minutes with screen turned off.
   - Tap **Pause All** in the notification: downloads pause and notification updates.
   - Unlock and return to app: state is completely synchronized.

### Test Case 3: Process Termination and Fast Resume
1. While downloading, force-close the app from Android Recent Apps.
2. Re-open TorrentFlow Mobile.
3. Verify:
   - Torrent appears in download list.
   - Engine reads persisted resume data from SQLite.
   - Download resumes without re-checking unchanged pieces.

### Test Case 4: .torrent File Selection & Real Download Start
1. Open **Add Torrent** screen.
2. Tap **Choose File** and pick an official Linux ISO `.torrent` file (from Downloads or Android Files app).
3. Verify:
   - File picker resolves `content://` and `file://` URIs without memory errors.
   - Metadata preview card displays exact parsed Name, Total Size, File count, and 40-hex info-hash.
4. Tap **Start Download**:
   - Engine confirms native add parameters.
   - State enters `Downloading` immediately.
   - Real piece verification and file creation commence.
   - Real download speed, seeds, and peers appear in Torrent Details and Downloads list.
   - Persistent notification updates with live speed.

### Test Case 5: Tab Navigation Scroll Reset & Reselection
1. Open **Settings** tab and scroll all the way to the bottom.
2. Switch to **Dashboard** tab.
3. Switch back to **Settings** tab.
4. Verify: Settings screen starts at the exact top (scroll position = 0).
5. Scroll down again, then tap the **Settings** icon on the bottom navigation bar.
6. Verify: Settings screen smoothly scrolls back to the top.
7. Repeat the same test for **Downloads** (FlatList), **Activity** (ScrollView), and **Dashboard** (ScrollView).

