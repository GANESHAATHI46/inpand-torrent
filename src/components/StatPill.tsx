import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface StatPillProps {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}

export const StatPill: React.FC<StatPillProps> = ({ icon, label, value, color }) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceVariant,
          borderRadius: spacing.borderRadiusMd,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.sm + 2,
        },
      ]}
    >
      {icon ? <View style={{ marginRight: spacing.xs }}>{icon}</View> : null}
      <Text style={[styles.label, { color: colors.textMuted, fontSize: typography.sizes.caption }]}>
        {label}:
      </Text>
      <Text
        style={[
          styles.value,
          {
            color: color || colors.text,
            fontSize: typography.sizes.small,
            marginLeft: spacing.xs,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '500',
  },
  value: {
    fontWeight: '700',
  },
});

