# Google Play Store Handover Guide

This document is prepared specifically for the **Publishing and Release Team** responsible for signing, uploading, and managing TorrentFlow Mobile on Google Play Console.

---

## 1. Release Package Details

- **Application Name**: `TorrentFlow Mobile`
- **Application ID / Package Name**: `com.torrentflow.mobile`
- **Target SDK**: Android 14 (API level 34)
- **Minimum SDK**: Android 7.0 (API level 24)
- **Architecture**: `arm64-v8a`, `armeabi-v7a`, `x86_64`
- **Release Artifact**: Android App Bundle (`.aab`)

---

## 2. Release Signing Configuration

Do **NOT** commit private release keystores or passwords to git repositories.

The Gradle build is configured to read credentials from environment variables or a local `android/key.properties` file:

### Method A: Environment Variables (Recommended for CI/CD)
Set the following environment variables on your CI/CD runner:
```bash
export TORRENTFLOW_RELEASE_STORE_FILE="/path/to/your/production.keystore"
export TORRENTFLOW_RELEASE_STORE_PASSWORD="<production_store_password>"
export TORRENTFLOW_RELEASE_KEY_ALIAS="<production_key_alias>"
export TORRENTFLOW_RELEASE_KEY_PASSWORD="<production_key_password>"
```

### Method B: Local key.properties (Manual Publishing)
Create a file at `android/key.properties` (this file is excluded in `.gitignore`):
```properties
storeFile=/absolute/path/to/production.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

Run bundle generation:
```bash
cd android
./gradlew bundleRelease
```
Artifact location: `android/app/build/outputs/bundle/release/app-release.aab`.

---

## 3. Google Play Console Declarations

When creating the store listing in Google Play Console, declare the following policies:

### A. Foreground Service Declaration (Android 14+)
- **Type**: `dataSync`
- **Justification**: "TorrentFlow Mobile is a BitTorrent peer-to-peer client that transfers large files continuously in the background upon explicit user request. The foreground service with persistent progress notification is necessary to prevent network drops and OS process termination while transferring chunks from peer swarms."
- **Video Proof**: Record a short 15-second clip showing the app starting a download, closing to the home screen, and the ongoing notification updating with speeds.

### B. Data Safety Form
- **Data Collected**: None.
- **Data Shared**: None.
- **Personal Information**: None.
- TorrentFlow Mobile operates on a peer-to-peer model. It does not collect user data, track identities, or transmit telemetry to centralized analytics servers.

### C. App Content / Content Rating
- BitTorrent clients typically receive a **PEGI 3 / ESRB Everyone** rating with a note that the application provides access to user-generated peer-to-peer network transfers.

---

## 4. Play Console Upload Checklist

- [ ] Upload `app-release.aab` to Internal or Closed Testing track.
- [ ] Upload ProGuard mapping file `android/app/build/outputs/mapping/release/mapping.txt` to deobfuscate stack traces in Android Vitals.
- [ ] Verify test track downloads on a real Android 14+ device.
- [ ] Complete Data Safety Questionnaire.
- [ ] Complete Foreground Service `dataSync` justification.
- [ ] Submit for Google Play review.

