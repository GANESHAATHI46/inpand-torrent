# TORRENTFLOW MOBILE — DELETE BUTTON BUG FIX REPORT
**Date**: November 5, 2026  
**Status**: RESOLVED & VERIFIED  
**Component**: Torrent Deletion Pipeline (React Native UI, TypeScript Engine, SQLite Persistence, Kotlin TorrentManager, C++ JNI libtorrent Bridge, Python SessionManager)

---

## 1. Executive Summary & Root Cause Analysis

### Identified Root Causes

Prior to this fix, clicking the delete button exhibited multiple failure modes across different UI screens and runtime environments:

1. **React Native Touch Responder & Event Bubbling Conflict**:
   In `app/(tabs)/downloads.tsx`, each torrent card was wrapped in an outer `<TouchableOpacity onPress={() => router.push('/torrent-details/...')} activeOpacity={0.7}>`. The inner action buttons (Play/Pause and Delete) were also `<TouchableOpacity>` elements nested directly inside the card container.
   - **On Web**: Browser click events bubbled from the inner delete button to the outer card touchable, immediately triggering navigation to the details screen before or during any delete confirmation.
   - **On Android/iOS**: Nested touch responders caused gesture stealing and responder cancellation, causing taps on the trash button to either be ignored or trigger card navigation instead.

2. **Cross-Platform Dialog Incompatibility (`Alert.alert`)**:
   Both `downloads.tsx` and `torrent-details/[hash].tsx` invoked `Alert.alert` with three action buttons (`Cancel`, `Remove`, `Remove & Delete Files`).
   - In React Native Web and certain mobile viewports, 3-button `Alert.alert` calls are not standardly supported, resulting in truncated action sheets or unhandled dialog dismissals.

3. **Invalid Expo Router Navigation Target**:
   Upon deleting a torrent in `torrent-details/[hash].tsx`, the screen executed `router.replace('/downloads')`. In Expo Router v6, tab routes are placed in route groups (`app/(tabs)/downloads.tsx`), making `/downloads` an invalid or non-existent route path. The correct canonical route is `/(tabs)/downloads`.

4. **Component State Race Condition & Screen Flashing**:
   In `torrent-details/[hash].tsx`, the screen continuously retrieved the active torrent via `torrents.find(...)`. When `removeTorrent(...)` was executed, the torrent was immediately purged from the shared session state, causing `torrent` to evaluate to `undefined` on the next render cycle before navigation could transition. This triggered the fallback screen, flashing an erroneous `"Torrent Not Found"` error view before attempting navigation.

5. **Incomplete Cascade Deletion in SQLite**:
   Foreign key cascade constraints (`ON DELETE CASCADE`) are not activated automatically by default in all SQLite connections unless explicit transactions or pragmas are executed. Deleting from `torrents` risked leaving orphaned rows in `torrent_files` and `trackers`.

6. **Missing Directory Traversal & Root Protection in File Deletion**:
   Previous file removal logic blindly concatenated paths without verifying canonical paths or preventing malicious directory traversal (e.g. `../../`), posing a potential security hazard to user files.

---

## 2. Solution Architecture & Technical Implementation

### A. Dedicated Cross-Platform Modal (`DeleteTorrentModal.tsx`)
Created `src/components/DeleteTorrentModal.tsx`:
- Provides a clean, custom modal dialog that works reliably across Android, iOS, and Web preview.
- Displays the torrent name, total size, and current status.
- Offers two explicit deletion modes:
  - **Mode A ("Remove Torrent Only")**: Stops active transfer, removes from libtorrent session, removes SQLite database record and resume data, but preserves all downloaded files on storage.
  - **Mode B ("Remove & Delete Files")**: Highlighted in red with a destructive indicator (`trash-bin-outline`). Stops transfer, purges native session, deletes database records, and securely purges all downloaded files and `.part` files from storage.
- Includes a built-in `loading` state with `ActivityIndicator` to prevent duplicate or accidental double-tap submissions while I/O is executing.

### B. UI Card Touchable Isolation (`downloads.tsx`)
Restructured the card hierarchy in `app/(tabs)/downloads.tsx`:
- Removed the overarching `<TouchableOpacity>` wrapping the entire card.
- Made the card body (Title, StatusBadge, ProgressBar, Size, and Speed) a dedicated touchable navigating to details.
- Placed the bottom row (Peers/Seeds count and Action Buttons) outside the main body touchable.
- Added explicit accessibility labels (`"Delete torrent"`) and connected `onPress={() => setDeletingTorrent(item)}` to trigger the `DeleteTorrentModal`.

### C. Details Screen Deletion Flow (`torrent-details/[hash].tsx`)
- Added `isDeleting` state guard. While deletion is in progress, the screen displays a dedicated `"Removing Torrent"` state, completely eliminating the "Torrent Not Found" flash.
- Replaced `router.replace('/downloads')` with canonical `router.replace('/(tabs)/downloads')`.
- Hooked the header trash button (`rightActionIcon="trash-outline"`) to open `DeleteTorrentModal`.
- Added a prominent **"Manage Torrent" / "Delete Torrent"** button inside the Overview tab under a dedicated card to provide an intuitive in-page deletion trigger.

### D. Concurrency & Re-Entrancy Guard in Engine (`TorrentEngine.ts`)
Updated `src/services/TorrentEngine.ts`:
- Added `pendingDeletions: Set<string> = new Set()`.
- Implemented `isDeleting(infoHash)` method.
- In `removeTorrent(infoHash, deleteFiles)`:
  1. Validates info-hash and guards against concurrent/duplicate requests via `pendingDeletions`.
  2. Calls native Android module `TorrentEngineModule.removeTorrent(hash, deleteFiles)` first to instantly halt socket I/O, DHT lookups, disk writing, and alert emissions.
  3. Ignores any incoming alerts (`handleStateUpdate`, `handleMetadataReceived`, `handleTorrentFinished`, `handleTorrentError`) for torrents currently pending deletion.
  4. Calls `DatabaseService.deleteTorrent(hash)` to atomically cascade delete database records.
  5. Removes torrent from in-memory `activeTorrents` map.
  6. Recalculates dashboard statistics (active count, speed, total sizes) and broadcasts updates to all active listeners (`notifyListeners()`).

### E. Atomic Cascade Deletion (`DatabaseService.ts`)
Updated `src/services/DatabaseService.ts`:
- Enclosed deletion in `withTransactionAsync`:
  ```ts
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM torrent_files WHERE info_hash = ?;`, [hash]);
    await db.runAsync(`DELETE FROM trackers WHERE info_hash = ?;`, [hash]);
    await db.runAsync(`DELETE FROM torrents WHERE info_hash = ?;`, [hash]);
  });
  ```
- Guarantees complete database cleanup with zero orphaned records, even if foreign key pragmas are toggled by third-party tooling.

### F. Native Android Safe Deletion (`TorrentManager.kt` & `torrent_engine_jni.cpp`)
- **Native C++ Engine (`torrent_engine_jni.cpp`)**:
  - `nativeRemoveTorrent` looks up the `lt::torrent_handle`.
  - Calls `g_session->session_ptr->remove_torrent(handle, deleteFiles ? lt::session::delete_files : 0)`.
  - Removes handle from internal map and logs engine status.
- **Android Kotlin Layer (`TorrentManager.kt`)**:
  - Persists `savePath` in `TorrentState` for both magnet links and `.torrent` files.
  - Implemented `safelyDeleteTorrentFiles(state)`:
    - Resolves base directory and target file/directory to canonical paths (`File.canonicalPath`).
    - Enforces directory traversal protection: verifies `canonicalTarget.startsWith(canonicalBase + File.separator)`.
    - Prevents accidental deletion of system root directories (`/`, `/storage/emulated/0`, `/sdcard`, `Environment.getExternalStorageDirectory()`).
    - Safely recurses multi-file directories (`deleteRecursively()`) or deletes single files and cleans up corresponding `.part` files.

### G. Python Session Manager Parity (`session_manager.py`)
- Updated `SessionManager.remove_torrent(info_hash, delete_files)` in `python/services/session_manager.py`.
- Added canonical path resolution (`os.path.realpath`) and directory traversal checks matching the Android native security implementation.

---

## 3. Verification & Test Results

### 1. TypeScript Static Compilation
Executed `npm run typecheck` (`tsc --noEmit`):
- **Result**: `EXIT CODE 0` (Zero compiler errors across all files).

### 2. Jest Unit Tests
Executed `npm test` (`jest`):
- **Test Suites**: 3 passed, 3 total
- **Tests**: 19 passed, 19 total
- **Suite Details**:
  - `tests/jest/formatters.test.ts`: 14 passed
  - `tests/jest/torrentParser.test.ts`: Passed
  - `tests/jest/torrentEngineDelete.test.ts`: 5 passed:
    - `Mode A: removes torrent from memory and database without deleting files`
    - `Mode B: removes torrent and requests native deletion of files`
    - `prevents concurrent duplicate deletion calls for the same hash`
    - `ignores empty or invalid info-hash gracefully`
    - `ignores native state update alerts for torrents currently pending deletion or deleted`

### 3. Python Unit Tests
Executed `python -m unittest discover -s tests/python -p "test_*.py"`:
- **Result**: `Ran 31 tests in 0.037s — OK`
- Added tests in `test_session_manager.py`:
  - `test_remove_torrent_mode_a_keep_files`: Verified payload file persists on disk when `delete_files=False`.
  - `test_remove_torrent_mode_b_delete_files`: Verified payload file is permanently deleted when `delete_files=True`.
  - `test_remove_torrent_path_traversal_protection`: Verified malicious `dn=../secret.txt` cannot traverse out of the assigned download directory.

---

## 4. Modified Files Summary

| File Path | Description of Changes |
| :--- | :--- |
| `src/components/DeleteTorrentModal.tsx` | **New component**: Cross-platform modal with Mode A / Mode B options, sizes, and double-tap prevention. |
| `app/(tabs)/downloads.tsx` | Fixed touch event bubbling by decoupling card click from action buttons; integrated `DeleteTorrentModal`. |
| `app/torrent-details/[hash].tsx` | Integrated `DeleteTorrentModal`, fixed navigation to `/(tabs)/downloads`, added `isDeleting` screen guard, added Delete button to Overview tab. |
| `app/(tabs)/index.tsx` | Fixed View All navigation target to `/(tabs)/downloads`. |
| `src/services/TorrentEngine.ts` | Added `pendingDeletions` guard, state update filtering, and synchronized native/DB deletion sequence. |
| `src/services/DatabaseService.ts` | Implemented atomic `withTransactionAsync` cascade deletion across `torrents`, `torrent_files`, `trackers`. |
| `android/app/src/main/java/com/torrentflow/mobile/torrent/TorrentManager.kt` | Added `savePath` tracking, native C++ call, canonical path validation, and traversal protection in `safelyDeleteTorrentFiles`. |
| `native/jni/torrent_engine_jni.cpp` | Integrated `lt::session::delete_files` flag support in `nativeRemoveTorrent`. |
| `python/services/session_manager.py` | Added canonical path validation and traversal protections in Python session manager. |
| `tests/python/test_session_manager.py` | Added unit tests for Mode A, Mode B, and path traversal protection. |
| `tests/jest/torrentEngineDelete.test.ts` | **New unit test suite**: 5 comprehensive unit tests for `TorrentEngine` deletion mechanics. |
| `DEVELOPMENT_STATUS.md` | Updated feature checklist and test suite results. |

