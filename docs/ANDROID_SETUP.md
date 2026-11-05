# Android Setup Guide

This document outlines the environment configuration required to develop, build, and debug **TorrentFlow Mobile** on an Android development machine.

---

## 1. Prerequisites

Ensure the following tools are installed on your host system:

| Component | Minimum Version | Recommended Version |
|---|---|---|
| **Node.js** | 20.x LTS | 24.x LTS |
| **npm** | 10.x | 11.x |
| **Java Development Kit (JDK)** | OpenJDK 17 | OpenJDK 17 (Eclipse Adoptium Temurin) |
| **Android SDK Platform** | API 24 (7.0) | API 34 (Android 14) |
| **Android NDK** | r23c | r25.1.8937393 or r26+ |
| **CMake** | 3.22.1 | 3.22.1+ |
| **Python** | 3.10 | 3.11+ |

---

## 2. Environment Variables

Configure your system environment variables (Windows PowerShell / Bash):

### Windows (PowerShell)
```powershell
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17', 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\<user>\AppData\Local\Android\Sdk', 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_NDK_HOME', 'C:\Users\<user>\AppData\Local\Android\Sdk\ndk\25.1.8937393', 'User')

# Add to PATH
$env:Path += ";$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
```

### Linux / macOS (Bash / Zsh)
```bash
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/25.1.8937393"
export PATH="$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

---

## 3. Verifying Android Toolchain

Run the following commands to confirm your environment is operational:
```bash
# Check Java
java -version

# Check ADB
adb version

# Check Android SDK packages
sdkmanager --list_installed
```

---

## 4. Connecting a Physical Android Device

To test real BitTorrent network throughput and background service operation:
1. Enable **Developer Options** on your Android device (tap *Build number* 7 times in Settings > About phone).
2. Enable **USB Debugging** in Developer options.
3. Connect your device via USB and verify ADB detection:
   ```bash
   adb devices
   ```
4. Verify notification and battery optimization settings:
   - Allow **Notifications** when prompted (required for Android 13+).
   - In App info > Battery, select **Unrestricted** to prevent aggressive OEM power management from killing background connections during extended screen-off testing.

