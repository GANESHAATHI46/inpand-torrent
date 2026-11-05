import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightActionIcon?: keyof typeof Ionicons.glyphMap;
  onRightAction?: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightActionIcon,
  onRightAction,
  showBack = false,
  onBack,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.divider,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={[styles.backBtn, { marginRight: spacing.sm }]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: typography.sizes.title,
              },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                  fontSize: typography.sizes.small,
                  marginTop: 2,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightActionIcon && onRightAction ? (
        <TouchableOpacity
          onPress={onRightAction}
          activeOpacity={0.7}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.surfaceVariant,
              borderRadius: spacing.borderRadiusMd,
              padding: spacing.sm,
            },
          ]}
        >
          <Ionicons name={rightActionIcon} size={20} color={colors.primaryLight} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontWeight: '400',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

