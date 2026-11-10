import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/Card';
import { TERMS_SECTIONS, TERMS_VERSION } from '../src/constants/termsAndConditions';

export default function TermsScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/settings');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, paddingHorizontal: spacing.lg }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={[styles.brand, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
            INPAND TORRENT
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.title }]}>
            Terms & Conditions
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={true}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[styles.versionBadge, { color: colors.primaryLight }]}>
            Version {TERMS_VERSION} • Effective Date: November 2026
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            These Terms & Conditions govern your access to and use of the Inpand Torrent decentralized BitTorrent client.
          </Text>
        </Card>

        {TERMS_SECTIONS.map((section) => (
          <Card key={section.id} style={{ marginBottom: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.content}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  brand: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontWeight: '800',
  },
  content: {
    paddingBottom: 32,
  },
  versionBadge: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  introText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
  },
});
