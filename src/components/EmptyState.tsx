import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'cloud-download-outline',
  title,
  description,
  actionTitle,
  onAction,
}) => {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.surfaceVariant,
            borderRadius: spacing.borderRadiusFull,
            padding: spacing.xl,
          },
        ]}
      >
        <Ionicons name={icon} size={48} color={colors.primaryLight} />
      </View>
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: typography.sizes.title,
            marginTop: spacing.lg,
          },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.description,
          {
            color: colors.textSecondary,
            fontSize: typography.sizes.body,
            marginTop: spacing.xs,
          },
        ]}
      >
        {description}
      </Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          style={{ marginTop: spacing.xl }}
          icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});

