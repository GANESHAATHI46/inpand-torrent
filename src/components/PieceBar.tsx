import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface PieceBarProps {
  numPieces: number;
  piecesProgress?: string | null; // string of '1' and '0' or bitfield
  progress: number;
}

export const PieceBar: React.FC<PieceBarProps> = ({ numPieces, piecesProgress, progress }) => {
  const { colors, spacing, typography } = useTheme();

  // Render a visual strip representing the pieces
  const blocksCount = Math.min(60, numPieces > 0 ? numPieces : 40);
  const blocks = [];

  for (let i = 0; i < blocksCount; i++) {
    let isComplete = false;
    if (piecesProgress && piecesProgress.length > 0) {
      const idx = Math.floor((i / blocksCount) * piecesProgress.length);
      isComplete = piecesProgress[idx] === '1';
    } else {
      isComplete = i / blocksCount < progress;
    }
    blocks.push(isComplete);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          PIECE AVAILABILITY ({numPieces > 0 ? `${numPieces} pieces` : 'Verifying'})
        </Text>
        <Text style={[styles.percent, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
          {(progress * 100).toFixed(1)}%
        </Text>
      </View>
      <View style={[styles.grid, { backgroundColor: colors.surfaceVariant, borderRadius: spacing.borderRadiusSm }]}>
        {blocks.map((complete, idx) => (
          <View
            key={idx}
            style={[
              styles.block,
              {
                backgroundColor: complete ? colors.primaryLight : colors.cardBorder,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  percent: {
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    height: 12,
    padding: 2,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 1.5,
  },
  block: {
    flex: 1,
    height: '100%',
    borderRadius: 1,
  },
});

