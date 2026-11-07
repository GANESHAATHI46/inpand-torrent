# Inpand Torrent 🌊

> Production-oriented, full-featured Android BitTorrent client built with React Native / Expo, native C++ libtorrent 2.1.x, Python 3.11 application logic, and persistent Android Foreground Services.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-green.svg)](https://android.com)
[![Engine](https://img.shields.io/badge/engine-libtorrent%202.1.x-orange.svg)](https://libtorrent.org)
[![React Native](https://img.shields.io/badge/frontend-Expo%2054%20%7C%20RN%200.81-61dafb.svg)](https://expo.dev)

---

## 📱 Application Overview

**Inpand Torrent** is an independent, native Android peer-to-peer torrent client designed specifically for high-throughput mobile downloading and seeding.

The application incorporates:
- **Mobile Frontend**: Expo SDK 54, React Native 0.81, TypeScript, Expo Router (file-based navigation), and a custom Material 3 / Slate responsive design system (supporting dark and light modes).
- **Core BitTorrent Engine**: Native C++ libtorrent 2.1.x compiled for Android ARM64-v8a (with armeabi-v7a and x86_64 fallback) providing real DHT, PEX, LSD, trackers, peer discovery, piece hashing, and fast resume serialization.
- **Python Application Layer**: Python 3.11 modules providing standards-compliant Bencoding/Bdecoding, Magnet URI parsing (hex and base32), metadata extraction, state machine transitions, and database models.
- **Android Native Layer**: Kotlin foreground service (`TorrentDownloadService`) with `dataSync` type, persistent progress notifications with Pause/Resume/Stop actions, `PartialWakeLock`, `WifiLock`, and Storage Access Framework.
- **Database & Persistence**: SQLite engine managing torrent queues, resume blobs, individual file priorities, and session recovery across app reboots.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **Dashboard** | Real-time aggregate download & upload speeds, overall progress, storage breakdown, and recent transfers. |
| **Add Torrent** | Magnet URI input, automatic clipboard magnet detection, `.torrent` file picker, and custom save directory. |
| **Downloads Manager** | Filter by All, Downloading, Completed, and Paused. Search by name or info-hash. Individual pause, resume, and file deletion. |
| **Torrent Details** | Visual piece map (`PieceBar`), piece layout, file tree with priority toggling (Normal/Skip/High), live peer list with client IDs, and tracker tier status. |
| **Background Execution** | Android Foreground Service ensures sustained downloading with screen turned off. CPU WakeLock and Wi-Fi Lock prevent OS throttling. |
| **Queue & Limits** | Configurable download/upload bandwidth limits (KB/s), connection limits, and Wi-Fi-only downloading. |
| **Swarm Activity** | Detailed telemetry on DHT node count (Mainline DHT), Peer Exchange (PEX), Local Service Discovery (LSD), and session uptime. |

---

## 🛠️ Project Structure

```
torrentflow-mobile/
├── app/                           # Expo Router file-based screens
│   ├── (tabs)/                    # Bottom tab navigator
│   │   ├── _layout.tsx            # Tab bar configuration & haptics
│   │   ├── index.tsx              # Dashboard screen
│   │   ├── downloads.tsx          # Downloads screen & search/filters
│   │   ├── activity.tsx           # Swarm & bandwidth activity
│   │   └── settings.tsx           # Settings & preferences
│   ├── _layout.tsx                # Root stack & theme provider
│   ├── add-torrent.tsx            # Modal: magnet / .torrent import
│   └── torrent-details/
│       └── [hash].tsx             # Detailed torrent inspector
├── src/                           # Mobile TypeScript source
│   ├── components/                # Reusable UI components (Card, Button, ProgressBar, etc.)
│   ├── hooks/                     # useTorrentSession, useTheme
│   ├── services/                  # TorrentEngine, DatabaseService, StorageService
│   ├── theme/                     # Colors, typography, spacing, ThemeContext
│   ├── types/                     # TorrentItem, SessionSettings, DashboardStats
│   └── utils/                     # Formatters (bytes, speeds, ETA, status)
├── python/                        # Python 3.11 application logic
│   ├── core/                      # bencode.py, magnet.py, types.py
│   ├── torrent/                   # metadata.py, state_machine.py, file_selector.py
│   ├── database/                  # schema.py, db_manager.py
│   └── services/                  # session_manager.py, bridge_protocol.py
├── android/                       # Native Android layer
│   ├── app/                       # Android app module (Manifest, ProGuard, build.gradle)
│   ├── native/                    # TorrentEngineJni.kt
│   ├── torrent/                   # TorrentManager.kt
│   ├── service/                   # TorrentDownloadService.kt, BootReceiver.kt, ServiceActionReceiver.kt
│   └── bridge/                    # TorrentEngineModule.kt, TorrentEnginePackage.kt
├── native/                        # Native C++ libtorrent engine
│   ├── CMakeLists.txt             # NDK CMake build definition
│   ├── jni/                       # torrent_engine_jni.cpp JNI implementation
│   └── libtorrent/                # build_libtorrent_android.sh build automation
├── assets/                        # Icons, adaptive icons, splash screen
├── tests/                         # Test suites
│   ├── jest/                      # TypeScript Jest unit tests
│   └── python/                    # Python unit tests (26 passing tests)
└── docs/                          # Architecture & Handover documentation
    ├── ARCHITECTURE.md
    ├── ANDROID_SETUP.md
    ├── LIBTORRENT_INTEGRATION.md
    ├── BUILD_INSTRUCTIONS.md
    ├── TESTING.md
    ├── PLAY_STORE_HANDOVER.md
    └── KNOWN_LIMITATIONS.md
```

---

## ⚡ Quick Start

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Verify Codebase
```bash
# Type check TypeScript
npm run typecheck

# Run Jest unit tests
npm test

# Run Python engine tests
python -m unittest discover -s tests/python -p "test_*.py"
```

### 3. Launch Development Server
```bash
npx expo start
```

For complete build and deployment instructions, refer to [`docs/BUILD_INSTRUCTIONS.md`](docs/BUILD_INSTRUCTIONS.md) and [`docs/PLAY_STORE_HANDOVER.md`](docs/PLAY_STORE_HANDOVER.md).

