import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          borderRadius: spacing.borderRadiusLg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
});
