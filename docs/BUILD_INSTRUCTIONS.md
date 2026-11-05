# Build Instructions

This document provides step-by-step commands to compile development builds, debug APKs, and release Android App Bundles (AABs).

---

## 1. Local Environment Preparation

Install project dependencies:
```bash
npm install
```

Verify TypeScript types and unit tests:
```bash
# TypeScript verification
npm run typecheck

# Jest JavaScript / TypeScript tests
npm test

# Python application logic tests
python -m unittest discover -s tests/python -p "test_*.py"
```

---

## 2. Generating Native Android Project (Expo Prebuild)

To generate the clean native Android project configured with custom native modules:
```bash
npx expo prebuild --platform android --clean
```

---

## 3. Building Debug APK

To compile and install a debug APK directly onto a connected physical Android device or emulator:
```bash
# Direct command line build
cd android
./gradlew assembleDebug

# Output APK path:
# android/app/build/outputs/apk/debug/app-debug.apk
```

Or run via Expo CLI:
```bash
npm run android
```

---

## 4. Building Production Release AAB (Google Play)

For Google Play Console submission, Google requires the **Android App Bundle (.aab)** format:

```bash
cd android
./gradlew bundleRelease
```

The resulting release bundle will be generated at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### ProGuard / R8 Optimization Verification
During `bundleRelease`, R8 executes using rules from `android/app/proguard-rules.pro`. To inspect the mapping file for symbol deobfuscation in Google Play Console:
```
android/app/build/outputs/mapping/release/mapping.txt
```

---

## 5. Building via EAS (Expo Application Services)

If a local Android SDK / NDK environment is not installed on your host machine, you can build release artifacts using cloud infrastructure via EAS Build:

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Login to your Expo account:
   ```bash
   eas login
   ```
3. Trigger cloud build:
   ```bash
   # Build production Android App Bundle (AAB)
   eas build --platform android --profile production

   # Build standalone APK for internal distribution
   eas build --platform android --profile preview
   ```

