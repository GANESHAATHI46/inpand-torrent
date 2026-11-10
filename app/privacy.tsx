import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/Card';

export default function PrivacyScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();

  const privacyPoints = [
    {
      title: '1. No Personal Data Collection',
      content:
        'Inpand Torrent is built with a zero-telemetry, privacy-first architecture. We do not require registration, accounts, emails, telephone numbers, or personal identifying information. The Software has no user databases and does not transmit your personal data to us or any third party.',
    },
    {
      title: '2. Decentralized P2P Protocol Notice',
      content:
        'The BitTorrent protocol is inherently decentralized and transparent. When transferring data in a torrent swarm, your public Internet Protocol (IP) address is broadcast to other participating peers and announced to trackers and DHT nodes to facilitate direct chunk-level data exchange. This is an unavoidable technical foundation of all peer-to-peer communications.',
    },
    {
      title: '3. Local Data Storage & SQLite',
      content:
        'All torrent metadata, file records, transfer statistics, and session configurations are stored entirely locally on your device within an encrypted private SQLite database and Android Sandboxed app storage. None of this data is uploaded or synced to external servers.',
    },
    {
      title: '4. Android Permissions',
      content:
        'The Software requests only the minimal necessary Android permissions: INTERNET (network data transfers), FOREGROUND_SERVICE & FOREGROUND_SERVICE_DATA_SYNC (background transfers), POST_NOTIFICATIONS (live speed status notification), and WAKE_LOCK / WIFI_LOCK (preventing system deep sleep during active downloads).',
    },
    {
      title: '5. Third-Party Websites & Trackers',
      content:
        'If you load magnet links or .torrent files from third-party websites or tracker indexing services, their individual privacy policies apply. Inpand Torrent has no control over and assumes no responsibility for third-party trackers or web services.',
    },
    {
      title: '6. Policy Updates',
      content:
        'Any updates to our Privacy Policy will be reflected in subsequent releases of the Software. Continued use of Inpand Torrent indicates acceptance of this Privacy Policy.',
    },
  ];

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
          <View style={styles.brandBadgeRow}>
            <Image
              source={require('../assets/logo-transparent.png')}
              style={styles.logoTiny}
              resizeMode="contain"
            />
            <Text style={[styles.brand, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
              INPAND TORRENT
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.title }]}>
            Privacy Policy
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={true}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.badgeRow}>
            <Ionicons name="lock-closed" size={16} color={colors.success} />
            <Text style={[styles.badgeText, { color: colors.success, marginLeft: 6 }]}>
              Zero-Telemetry • Local-First Architecture
            </Text>
          </View>
          <Text style={[styles.introText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Your privacy is fundamental. Inpand Torrent does not track, collect, monetize, or log your browsing, downloads, or transfers.
          </Text>
        </Card>

        {privacyPoints.map((p, idx) => (
          <Card key={idx} style={{ marginBottom: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{p.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{p.content}</Text>
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
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoTiny: {
    width: 18,
    height: 18,
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
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
