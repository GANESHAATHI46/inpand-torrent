import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';

export default function TabLayout() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === 'web';
  const bottomInset = isWeb ? 0 : insets.bottom;
  const baseContentHeight = isWeb ? 62 : 56;
  const tabHeight = baseContentHeight + bottomInset;
  const paddingBottom = Math.max(bottomInset, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingTop: 6,
          paddingBottom: paddingBottom,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: colors.primaryLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: typography.sizes.caption,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'speedometer' : 'speedometer-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: 'Downloads',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'cloud-download' : 'cloud-download-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'pulse' : 'pulse-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

