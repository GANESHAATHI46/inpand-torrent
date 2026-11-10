import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTorrentSession } from '../../src/hooks/useTorrentSession';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { DeleteTorrentModal } from '../../src/components/DeleteTorrentModal';
import { TorrentItem } from '../../src/types/torrent';
import { formatBytes, formatSpeed, formatEta } from '../../src/utils/formatters';
import { useTabScrollReset } from '../../src/hooks/useTabScrollReset';

type FilterType = 'all' | 'downloading' | 'completed' | 'paused';

export default function DownloadsScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { torrents, pauseTorrent, resumeTorrent, removeTorrent } = useTorrentSession();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingTorrent, setDeletingTorrent] = useState<TorrentItem | null>(null);
  const listRef = useTabScrollReset<FlatList>();

  const filteredTorrents = torrents.filter((t) => {
    // 1. Text filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchHash = t.infoHash.toLowerCase().includes(q);
      if (!matchName && !matchHash) return false;
    }

    // 2. Tab filter
    if (activeFilter === 'downloading') {
      return (
        t.status === 'downloading' ||
        t.status === 'downloading_metadata' ||
        t.status === 'checking' ||
        t.status === 'connecting_peers' ||
        t.status === 'stalled'
      );
    }
    if (activeFilter === 'completed') {
      return t.status === 'finished' || t.status === 'seeding';
    }
    if (activeFilter === 'paused') {
      return t.status === 'paused';
    }
    return true;
  });

  const handleActionToggle = (t: TorrentItem) => {
    if (t.status === 'paused') {
      resumeTorrent(t.infoHash);
    } else {
      pauseTorrent(t.infoHash);
    }
  };

  const renderTorrentCard = ({ item }: { item: TorrentItem }) => {
    const isPaused = item.status === 'paused';
    const isComplete = item.status === 'finished' || item.status === 'seeding';

    return (
      <Card style={styles.card}>
        {/* Clickable Card Body for details navigation */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/torrent-details/${item.infoHash}`)}
        >
          {/* Title and Status Badge */}
          <View style={styles.cardTopRow}>
            <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <StatusBadge status={item.status} />
          </View>

          {/* Progress bar */}
          <ProgressBar
            progress={item.progress}
            status={item.status}
            height={6}
            style={{ marginVertical: spacing.sm + 2 }}
          />

          {/* Size and Speed info */}
          <View style={styles.statsRow}>
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {formatBytes(item.downloadedBytes)} / {formatBytes(item.totalSize)} ({(item.progress * 100).toFixed(1)}%)
            </Text>
            <Text style={[styles.statText, { color: colors.speedDown, fontWeight: '700' }]}>
              {item.downloadRate > 0 ? formatSpeed(item.downloadRate) : isComplete ? 'Seeding' : '—'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Peers, Seeds, ETA and Independent Action Buttons */}
        <View style={[styles.cardBottomRow, { borderTopColor: colors.divider, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/torrent-details/${item.infoHash}`)}
            style={styles.peersCol}
          >
            <Text style={[styles.metaInfo, { color: colors.textMuted }]}>
              Peers: {item.numPeers} ({item.totalPeers}) • Seeds: {item.numSeeds} ({item.totalSeeds})
            </Text>
            {!isComplete && item.status !== 'paused' ? (
              <Text style={[styles.metaInfo, { color: colors.textMuted }]}>
                ETA: {formatEta(item.eta)}
              </Text>
            ) : null}
          </TouchableOpacity>

          <View style={styles.actionButtonsRow}>
            {/* Play / Pause button */}
            <TouchableOpacity
              onPress={() => handleActionToggle(item)}
              style={[
                styles.iconBtn,
                { backgroundColor: colors.surfaceVariant, marginRight: spacing.xs },
              ]}
              accessibilityLabel={isPaused ? 'Resume torrent' : 'Pause torrent'}
            >
              <Ionicons
                name={isPaused ? 'play' : 'pause'}
                size={16}
                color={isPaused ? colors.success : colors.text}
              />
            </TouchableOpacity>

            {/* Delete button */}
            <TouchableOpacity
              onPress={() => setDeletingTorrent(item)}
              style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant }]}
              accessibilityLabel="Delete torrent"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, paddingHorizontal: spacing.lg }]}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.brand, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
              INPAND TORRENT
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.h2 }]}>
              Downloads
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: spacing.borderRadiusMd }]}
          onPress={() => router.push('/add-torrent')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
          <TextInput
            placeholder="Search torrents by name or hash..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Segmented Filter Bar */}
      <View style={[styles.filterBar, { paddingHorizontal: spacing.lg, marginVertical: spacing.md }]}>
        {(['all', 'downloading', 'completed', 'paused'] as FilterType[]).map((tab) => {
          const isSelected = activeFilter === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveFilter(tab)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                  borderRadius: spacing.borderRadiusMd,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Torrents List */}
      <FlatList
        ref={listRef}
        data={filteredTorrents}
        keyExtractor={(item) => item.infoHash}
        renderItem={renderTorrentCard}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.lg }]}
        ListEmptyComponent={
          <EmptyState
            icon="cloud-download-outline"
            showLogo={!searchQuery && activeFilter === 'all'}
            title="No Torrents Found"
            description={
              searchQuery
                ? `No downloads match "${searchQuery}".`
                : activeFilter !== 'all'
                ? `No torrents currently in "${activeFilter}" state.`
                : 'You have not added any torrents yet. Tap below to start downloading.'
            }
            actionTitle={searchQuery || activeFilter !== 'all' ? undefined : 'Add Torrent'}
            onAction={() => router.push('/add-torrent')}
          />
        }
      />

      {/* Delete Confirmation Modal */}
      <DeleteTorrentModal
        visible={deletingTorrent !== null}
        torrent={deletingTorrent}
        onClose={() => setDeletingTorrent(null)}
        onConfirm={async (deleteFiles) => {
          if (deletingTorrent) {
            await removeTorrent(deletingTorrent.infoHash, deleteFiles);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  brand: {
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontWeight: '800',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 4,
    fontSize: 13,
  },
  searchContainer: {},
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 96,
    flexGrow: 1,
  },
  card: {
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 13,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  peersCol: {
    flex: 1,
  },
  metaInfo: {
    fontSize: 11,
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

