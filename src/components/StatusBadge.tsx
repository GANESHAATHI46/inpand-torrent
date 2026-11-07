import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { TorrentStatus } from '../types/torrent';
import { formatStatusLabel } from '../utils/formatters';

interface StatusBadgeProps {
  status: TorrentStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { colors, spacing, typography } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'downloading':
        return colors.primaryLight;
      case 'finished':
      case 'seeding':
        return colors.success;
      case 'paused':
        return colors.textMuted;
      case 'error':
        return colors.danger;
      case 'checking':
      case 'downloading_metadata':
      case 'connecting_peers':
      case 'stalled':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const color = getStatusColor();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: `${color}18`,
          borderRadius: spacing.borderRadiusSm,
          paddingVertical: 3,
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text
        style={[
          styles.text,
          {
            color,
            fontSize: typography.sizes.caption,
            marginLeft: spacing.xs,
          },
        ]}
      >
        {formatStatusLabel(status)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

