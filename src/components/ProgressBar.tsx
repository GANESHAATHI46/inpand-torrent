import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TorrentStatus } from '../types/torrent';

interface ProgressBarProps {
  progress: number; // 0.0 to 1.0
  status?: TorrentStatus;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status = 'downloading',
  height = 6,
  style,
}) => {
  const { colors, spacing } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress || 0));

  const getFillColor = () => {
    switch (status) {
      case 'finished':
      case 'seeding':
        return colors.success;
      case 'paused':
        return colors.textMuted;
      case 'error':
        return colors.danger;
      case 'checking':
      case 'downloading_metadata':
        return colors.warning;
      case 'downloading':
      default:
        return colors.primaryLight;
    }
  };

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: colors.progressBarBg,
          borderRadius: spacing.borderRadiusFull,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: getFillColor(),
            borderRadius: spacing.borderRadiusFull,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

