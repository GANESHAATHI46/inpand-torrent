import React, { useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTorrentIntentListener } from '../src/hooks/useTorrentIntentListener';
import { TermsModal } from '../src/components/TermsModal';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNav() {
  const { colors, isDark } = useTheme();
  useTorrentIntentListener();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    if (Platform.OS === 'android') {
      const requestAndroidPermissions = async () => {
        try {
          if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              'android.permission.READ_MEDIA_VIDEO' as any,
              'android.permission.READ_MEDIA_AUDIO' as any,
              'android.permission.READ_MEDIA_IMAGES' as any,
            ]);
          } else {
            await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            ]);
          }
        } catch (e) {
          // Ignore
        }
      };
      requestAndroidPermissions();
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <TermsModal />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-torrent"
          options={{
            presentation: 'modal',
            title: 'Add Torrent',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="torrent-details/[hash]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="terms"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="licenses"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

