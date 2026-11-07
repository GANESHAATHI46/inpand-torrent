import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTorrentSession } from '../../src/hooks/useTorrentSession';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { StatusBadge } from '../../src/components/StatusBadge';
import { Button } from '../../src/components/Button';
import { formatBytes, formatSpeed } from '../../src/utils/formatters';
import { StorageService } from '../../src/services/StorageService';
import { useTabScrollReset } from '../../src/hooks/useTabScrollReset';

export default function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { torrents, stats, pauseAll, resumeAll } = useTorrentSession();
  const [refreshing, setRefreshing] = useState(false);
  const [diskSpace, setDiskSpace] = useState({ free: 0, total: 0 });
  const scrollRef = useTabScrollReset<ScrollView>();

  useEffect(() => {
    StorageService.getInstance().getAvailableDiskSpace().then(setDiskSpace);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await StorageService.getInstance().getAvailableDiskSpace().then(setDiskSpace);
    setTimeout(() => setRefreshing(false), 400);
  };

  const recentTorrents = [...torrents]
    .sort((a, b) => b.addedDate - a.addedDate)
    .slice(0, 4);

  const usedDisk = diskSpace.total - diskSpace.free;
  const diskProgress = diskSpace.total > 0 ? usedDisk / diskSpace.total : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider, paddingHorizontal: spacing.lg }]}>
        <View>
          <Text style={[styles.brand, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
            INPAND TORRENT
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: typography.sizes.h2 }]}>
            Dashboard
          </Text>
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

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryLight} />}
      >
        {/* Real-time Speed Cards */}
        <View style={styles.speedRow}>
          <Card style={[styles.speedCard, { marginRight: spacing.sm }]}>
            <View style={styles.speedHeader}>
              <Ionicons name="arrow-down-circle" size={20} color={colors.speedDown} />
              <Text style={[styles.speedLabel, { color: colors.textSecondary }]}>Download</Text>
            </View>
            <Text style={[styles.speedValue, { color: colors.speedDown }]}>
              {formatSpeed(stats.downloadSpeed)}
            </Text>
            <Text style={[styles.speedSub, { color: colors.textMuted }]}>
              {stats.activeDownloads} active transfer{stats.activeDownloads === 1 ? '' : 's'}
            </Text>
          </Card>

          <Card style={[styles.speedCard, { marginLeft: spacing.sm }]}>
            <View style={styles.speedHeader}>
              <Ionicons name="arrow-up-circle" size={20} color={colors.speedUp} />
              <Text style={[styles.speedLabel, { color: colors.textSecondary }]}>Upload</Text>
            </View>
            <Text style={[styles.speedValue, { color: colors.speedUp }]}>
              {formatSpeed(stats.uploadSpeed)}
            </Text>
            <Text style={[styles.speedSub, { color: colors.textMuted }]}>
              {stats.completedDownloads} seeding
            </Text>
          </Card>
        </View>

        {/* Global Progress Card */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Overall Progress</Text>
            <Text style={[styles.percentText, { color: colors.primaryLight }]}>
              {(stats.overallProgress * 100).toFixed(1)}%
            </Text>
          </View>
          <ProgressBar progress={stats.overallProgress} height={8} style={{ marginVertical: spacing.md }} />
          <View style={styles.progressStatsRow}>
            <Text style={[styles.statSub, { color: colors.textSecondary }]}>
              Downloaded: {formatBytes(stats.totalDownloaded)}
            </Text>
            <Text style={[styles.statSub, { color: colors.textSecondary }]}>
              Total: {formatBytes(stats.totalSize)}
            </Text>
          </View>

          {/* Quick Queue Controls */}
          <View style={[styles.controlsRow, { borderTopColor: colors.divider, marginTop: spacing.md, paddingTop: spacing.md }]}>
            <Button
              title="Pause All"
              variant="secondary"
              size="sm"
              onPress={pauseAll}
              icon={<Ionicons name="pause" size={14} color={colors.text} />}
              style={{ flex: 1, marginRight: spacing.xs }}
            />
            <Button
              title="Resume All"
              variant="secondary"
              size="sm"
              onPress={resumeAll}
              icon={<Ionicons name="play" size={14} color={colors.text} />}
              style={{ flex: 1, marginLeft: spacing.xs }}
            />
          </View>
        </Card>

        {/* Statistics Grid */}
        <View style={[styles.gridRow, { marginTop: spacing.md }]}>
          <Card style={[styles.gridItem, { marginRight: spacing.xs }]}>
            <Text style={[styles.gridValue, { color: colors.primaryLight }]}>{stats.totalTorrents}</Text>
            <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Total Torrents</Text>
          </Card>
          <Card style={[styles.gridItem, { marginHorizontal: spacing.xs }]}>
            <Text style={[styles.gridValue, { color: colors.speedDown }]}>{stats.activeDownloads}</Text>
            <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Downloading</Text>
          </Card>
          <Card style={[styles.gridItem, { marginHorizontal: spacing.xs }]}>
            <Text style={[styles.gridValue, { color: colors.success }]}>{stats.completedDownloads}</Text>
            <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Completed</Text>
          </Card>
          <Card style={[styles.gridItem, { marginLeft: spacing.xs }]}>
            <Text style={[styles.gridValue, { color: colors.warning }]}>{stats.pausedDownloads}</Text>
            <Text style={[styles.gridLabel, { color: colors.textMuted }]}>Paused</Text>
          </Card>
        </View>

        {/* Storage Usage Card */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="folder-outline" size={18} color={colors.primaryLight} style={{ marginRight: spacing.xs }} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Device Storage</Text>
            </View>
            <Text style={[styles.statSub, { color: colors.textSecondary }]}>
              {formatBytes(diskSpace.free)} free
            </Text>
          </View>
          <ProgressBar progress={diskProgress} height={6} style={{ marginVertical: spacing.md }} />
          <Text style={[styles.storageText, { color: colors.textMuted }]}>
            Used {formatBytes(usedDisk)} of {formatBytes(diskSpace.total)} total storage
          </Text>
        </Card>

        {/* Recent Downloads Section */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Torrents</Text>
          {torrents.length > 0 ? (
            <TouchableOpacity onPress={() => router.push('/(tabs)/downloads')}>
              <Text style={[styles.viewAllText, { color: colors.primaryLight }]}>View All ({torrents.length})</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {recentTorrents.length === 0 ? (
          <Card style={{ marginTop: spacing.sm, alignItems: 'center', paddingVertical: spacing.xl }}>
            <Ionicons name="cloud-download-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.noTorrentsTitle, { color: colors.text, marginTop: spacing.sm }]}>
              No active downloads
            </Text>
            <Text style={[styles.noTorrentsDesc, { color: colors.textSecondary }]}>
              Tap the Add button above to download from magnet URI or .torrent file.
            </Text>
          </Card>
        ) : (
          recentTorrents.map((t) => (
            <TouchableOpacity
              key={t.infoHash}
              activeOpacity={0.7}
              onPress={() => router.push(`/torrent-details/${t.infoHash}`)}
            >
              <Card style={{ marginTop: spacing.sm }}>
                <View style={styles.torrentHeader}>
                  <Text style={[styles.torrentName, { color: colors.text }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <StatusBadge status={t.status} />
                </View>
                <ProgressBar progress={t.progress} status={t.status} height={5} style={{ marginVertical: spacing.sm }} />
                <View style={styles.torrentMetaRow}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {formatBytes(t.downloadedBytes)} / {formatBytes(t.totalSize)}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.speedDown }]}>
                    {t.downloadRate > 0 ? formatSpeed(t.downloadRate) : '—'}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brand: {
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontWeight: '800',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 4,
    fontSize: 14,
  },
  content: {
    paddingBottom: 96,
  },
  speedRow: {
    flexDirection: 'row',
  },
  speedCard: {
    flex: 1,
  },
  speedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speedLabel: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  speedValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  speedSub: {
    fontSize: 12,
    marginTop: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  percentText: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statSub: {
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  gridValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  storageText: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noTorrentsTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  noTorrentsDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  torrentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  torrentName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  torrentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

