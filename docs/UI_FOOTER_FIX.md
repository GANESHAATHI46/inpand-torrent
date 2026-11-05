# TorrentFlow Mobile — UI Footer & Bottom Navigation Fix

## 1. Issue Diagnosis

### Root Cause
1. **Android Edge-to-Edge Display**:
   With Android edge-to-edge window configuration (`edgeToEdgeEnabled=true` in `gradle.properties` and default on modern Android 14/15/16), the application viewport extends under both the system status bar and the bottom system navigation bar.
2. **Fixed Tab Bar Height**:
   The Expo Router tab layout previously set a static height (`height: 62`) for the bottom tab bar without accounting for system navigation bar insets. On devices using standard **3-button navigation** (which occupies ~48dp), the Android system back/home/recents buttons directly overlapped the tab icons and labels (Dashboard, Downloads, Activity, Settings), rendering them partially hidden or unclickable.
3. **Scrollable Content Occlusion**:
   Scrollable views (`ScrollView` and `FlatList`) across Dashboard, Downloads, Activity, and Settings previously used insufficient bottom padding (`paddingBottom: 40`), causing the final cards or list items to sit directly beneath the floating/fixed tab bar.

---

## 2. Solution Implementation

### A. Dynamic Inset-Aware Tab Bar (`app/(tabs)/_layout.tsx`)
We replaced static dimensions with dynamic insets provided by `react-native-safe-area-context`:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const baseContentHeight = 58;
  const bottomInset = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8);
  const tabHeight = baseContentHeight + (Platform.OS === 'web' ? 0 : insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      ...
    </Tabs>
  );
}
```

### B. Safe Scroll Bottom Padding
All primary tab screens now include `paddingBottom: 96` on their root `contentContainerStyle`:
- `app/(tabs)/index.tsx`: Dashboard scroll container (`paddingBottom: 96`).
- `app/(tabs)/downloads.tsx`: Downloads list container (`listContent.paddingBottom: 96`).
- `app/(tabs)/activity.tsx`: Activity metrics scroll container (`paddingBottom: 96`).
- `app/(tabs)/settings.tsx`: Settings scroll container (`paddingBottom: 96`).

This ensures that the last card, button, or list item can be fully scrolled into view with comfortable breathing room above the tab bar.

---

## 3. Supported Navigation Modes & Form Factors

| Mode | System Inset | Tab Bar Total Height | Visual Behavior |
| :--- | :--- | :--- | :--- |
| **Android 3-Button Navigation** | 48dp | 106dp | Tab content elevated above physical buttons |
| **Android Gesture Navigation** | 16–24dp | 74–82dp | Safe clearance above gesture navigation bar |
| **Small Screens (< 360dp width)** | Variable | Dynamic | Tab labels and icons remain properly centered |
| **Expo Web Preview** | 0dp (safe fallback 8dp) | 58dp | Fixed desktop/mobile browser layout |
| **iOS Devices** | 34dp (Home Bar) | 92dp | Natural clearance above iOS home indicator |

---

## 4. Theme & Appearance
- **Dark Theme**: Tab bar uses `colors.surface` (`#1A1D24`), `colors.border` (`#2C3240`), active tint `#3D7EFF`, inactive tint `#8E9AA8`.
- **Light Theme**: Tab bar uses `colors.surface` (`#FFFFFF`), `colors.border` (`#E2E8F0`), active tint `#2B6CB0`, inactive tint `#64748B`.
- Elevation (`elevation: 12`) and hairlineWidth borders provide clear tactile separation from background content.

