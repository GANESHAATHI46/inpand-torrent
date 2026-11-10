import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../src/theme/ThemeContext';
import { useTorrentSession } from '../../src/hooks/useTorrentSession';
import { Card } from '../../src/components/Card';
import { Header } from '../../src/components/Header';
import { ProgressBar } from '../../src/components/ProgressBar';
import { StatusBadge } from '../../src/components/StatusBadge';
import { PieceBar } from '../../src/components/PieceBar';
import { Button } from '../../src/components/Button';
import { DeleteTorrentModal } from '../../src/components/DeleteTorrentModal';
import { formatBytes, formatSpeed, formatEta, formatDate } from '../../src/utils/formatters';

type DetailTab = 'overview' | 'files' | 'trackers' | 'peers';

export default function TorrentDetailsScreen() {
  const { hash } = useLocalSearchParams<{ hash: string }>();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const { torrents, pauseTorrent, resumeTorrent, removeTorrent } = useTorrentSession();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const torrent = torrents.find(
    (t) => t.infoHash.toLowerCase() === (hash || '').toLowerCase()
  );

  if (isDeleting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title="Removing Torrent" showBack={false} />
        <View style={styles.notFoundCenter}>
          <ActivityIndicator size="large" color={colors.danger} />
          <Text style={[styles.notFoundTitle, { color: colors.text, marginTop: spacing.md }]}>
            Removing Torrent
          </Text>
          <Text style={[styles.notFoundSub, { color: colors.textSecondary }]}>
            Stopping session and cleaning up resources...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/downloads');
    }
  };

  if (!torrent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <Header title="Torrent Details" showBack onBack={handleBack} />
        <View style={styles.notFoundCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
          <Text style={[styles.notFoundTitle, { color: colors.text, marginTop: spacing.md }]}>
            Torrent Not Found
          </Text>
          <Text style={[styles.notFoundSub, { color: colors.textSecondary }]}>
            Hash: {hash}
          </Text>
          <Button
            title="Return to Downloads"
            onPress={() => router.replace('/(tabs)/downloads')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isPaused = torrent.status === 'paused';

  const handleCopyHash = async () => {
    try {
      await Clipboard.setStringAsync(torrent.infoHash);
      Alert.alert('Copied', 'Info-hash copied to clipboard.');
    } catch (e) {
      // Ignore clipboard write restrictions
    }
  };

  const handleRemove = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (deleteFiles: boolean) => {
    setIsDeleting(true);
    setShowDeleteModal(false);
    try {
      await removeTorrent(torrent.infoHash, deleteFiles);
      router.replace('/(tabs)/downloads');
    } catch (err) {
      console.error('Failed to remove torrent:', err);
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header
        title={torrent.name}
        subtitle={formatBytes(torrent.totalSize)}
        showBack
        onBack={handleBack}
        rightActionIcon="trash-outline"
        onRightAction={handleRemove}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Status and Progress Summary Card */}
        <Card>
          <View style={styles.topStatusRow}>
            <StatusBadge status={torrent.status} />
            <Text style={[styles.progressPercent, { color: colors.primaryLight }]}>
              {(torrent.progress * 100).toFixed(1)}%
            </Text>
          </View>

          <ProgressBar
            progress={torrent.progress}
            status={torrent.status}
            height={8}
            style={{ marginVertical: spacing.md }}
          />

          <View style={styles.speedRow}>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>DOWNLOAD SPEED</Text>
              <Text style={[styles.statVal, { color: colors.speedDown }]}>
                {formatSpeed(torrent.downloadRate)}
              </Text>
            </View>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>UPLOAD SPEED</Text>
              <Text style={[styles.statVal, { color: colors.speedUp }]}>
                {formatSpeed(torrent.uploadRate)}
              </Text>
            </View>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>ETA</Text>
              <Text style={[styles.statVal, { color: colors.text }]}>
                {formatEta(torrent.eta)}
              </Text>
            </View>
          </View>

          {/* Piece Bar visualization */}
          <PieceBar
            numPieces={torrent.numPieces}
            piecesProgress={torrent.piecesProgress}
            progress={torrent.progress}
          />

          {/* Quick Action buttons */}
          <View style={[styles.actionRow, { borderTopColor: colors.divider, marginTop: spacing.md, paddingTop: spacing.md }]}>
            <Button
              title={isPaused ? 'Resume' : 'Pause'}
              variant={isPaused ? 'primary' : 'secondary'}
              onPress={() => (isPaused ? resumeTorrent(torrent.infoHash) : pauseTorrent(torrent.infoHash))}
              icon={<Ionicons name={isPaused ? 'play' : 'pause'} size={16} color="#FFFFFF" />}
              style={{ flex: 1, marginRight: spacing.xs }}
            />
            <Button
              title="Copy Hash"
              variant="secondary"
              onPress={handleCopyHash}
              icon={<Ionicons name="copy-outline" size={16} color={colors.text} />}
              style={{ flex: 1, marginLeft: spacing.xs }}
            />
          </View>
        </Card>

        {/* Tab Selector */}
        <View style={[styles.tabBar, { borderBottomColor: colors.divider, marginVertical: spacing.md }]}>
          {(['overview', 'files', 'trackers', 'peers'] as DetailTab[]).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabItem,
                  { borderBottomColor: isSelected ? colors.primaryLight : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    { color: isSelected ? colors.primaryLight : colors.textSecondary },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'files' && torrent.files ? ` (${torrent.files.length})` : ''}
                  {tab === 'trackers' && torrent.trackers ? ` (${torrent.trackers.length})` : ''}
                  {tab === 'peers' && torrent.peers ? ` (${torrent.peers.length})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <View>
            <Card>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Info Hash</Text>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                  {torrent.infoHash}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Download Path</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{torrent.savePath}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Total Size</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatBytes(torrent.totalSize)} ({torrent.totalSize} bytes)
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Downloaded</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatBytes(torrent.downloadedBytes)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Uploaded</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatBytes(torrent.uploadedBytes)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Piece Layout</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {torrent.numPieces} pieces × {formatBytes(torrent.pieceLength)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Added On</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatDate(torrent.addedDate)}
                </Text>
              </View>

              {torrent.completedDate ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Completed On</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatDate(torrent.completedDate)}
                  </Text>
                </View>
              ) : null}

              {torrent.errorMessage ? (
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.infoLabel, { color: colors.danger }]}>Error</Text>
                  <Text style={[styles.infoValue, { color: colors.danger }]}>
                    {torrent.errorMessage}
                  </Text>
                </View>
              ) : null}
            </Card>

            {/* Danger Zone: Delete Torrent */}
            <Card style={{ marginTop: spacing.md, borderColor: colors.danger + '40' }}>
              <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 15, marginBottom: spacing.xs }}>
                Manage Torrent
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md }}>
                Remove this torrent from the active session. You can choose whether to keep or permanently delete the downloaded files.
              </Text>
              <Button
                title="Delete Torrent"
                variant="danger"
                icon={<Ionicons name="trash-outline" size={18} color="#FFFFFF" />}
                onPress={handleRemove}
              />
            </Card>
          </View>
        )}

        {/* Tab 2: Files */}
        {activeTab === 'files' && (
          <View>
            {(!torrent.files || torrent.files.length === 0) ? (
              <Card style={{ alignItems: 'center', padding: spacing.xl }}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Metadata exchange in progress. Files will appear once metadata is received.
                </Text>
              </Card>
            ) : (
              torrent.files.map((file, idx) => (
                <Card key={idx} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.fileHeader}>
                    <Ionicons name="document-text-outline" size={16} color={colors.primaryLight} style={{ marginRight: 6 }} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {file.path}
                    </Text>
                  </View>
                  <ProgressBar progress={file.progress} height={4} style={{ marginVertical: 6 }} />
                  <View style={styles.fileFooter}>
                    <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                      {formatBytes(file.downloadedBytes)} of {formatBytes(file.size)}
                    </Text>
                    <Text style={[styles.filePriority, { color: colors.primaryLight }]}>
                      Priority: {file.priority === 0 ? 'Skip' : file.priority === 7 ? 'High' : 'Normal'}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Tab 3: Trackers */}
        {activeTab === 'trackers' && (
          <View>
            {(!torrent.trackers || torrent.trackers.length === 0) ? (
              <Card style={{ alignItems: 'center', padding: spacing.xl }}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No external trackers configured. Torrent is discovering peers via DHT and PEX.
                </Text>
              </Card>
            ) : (
              torrent.trackers.map((tr, idx) => (
                <Card key={idx} style={{ marginBottom: spacing.sm }}>
                  <Text style={[styles.trackerUrl, { color: colors.text }]} numberOfLines={1}>
                    {tr.url}
                  </Text>
                  <View style={[styles.trackerMetaRow, { marginTop: 6 }]}>
                    <Text style={[styles.trackerStatus, { color: colors.success }]}>
                      Tier {tr.tier}: {tr.status}
                    </Text>
                    <Text style={[styles.trackerPeers, { color: colors.textMuted }]}>
                      Peers: {tr.peers} • Seeds: {tr.seeds}
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {/* Tab 4: Peers */}
        {activeTab === 'peers' && (
          <View>
            {(!torrent.peers || torrent.peers.length === 0) ? (
              <Card style={{ alignItems: 'center', padding: spacing.xl }}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No active peer connections in current interval. Connecting to swarm nodes...
                </Text>
              </Card>
            ) : (
              torrent.peers.map((peer, idx) => (
                <Card key={idx} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.peerHeader}>
                    <Text style={[styles.peerIp, { color: colors.text }]}>
                      {peer.ip}:{peer.port}
                    </Text>
                    <Text style={[styles.peerSpeed, { color: colors.speedDown }]}>
                      ↓ {formatSpeed(peer.downloadRate)}
                    </Text>
                  </View>
                  <View style={[styles.peerMetaRow, { marginTop: 4 }]}>
                    <Text style={[styles.peerClient, { color: colors.textSecondary }]}>
                      Client: {peer.client || 'Unknown'}
                    </Text>
                    <Text style={[styles.peerProgress, { color: colors.primaryLight }]}>
                      {(peer.progress * 100).toFixed(0)}%
                    </Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <DeleteTorrentModal
        visible={showDeleteModal}
        torrent={torrent}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  notFoundCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  notFoundSub: {
    fontSize: 12,
    marginTop: 4,
  },
  topStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 20,
    fontWeight: '800',
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#23304B',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  fileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileSize: {
    fontSize: 11,
  },
  filePriority: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  trackerUrl: {
    fontSize: 13,
    fontWeight: '600',
  },
  trackerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackerStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  trackerPeers: {
    fontSize: 12,
  },
  peerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  peerIp: {
    fontSize: 13,
    fontWeight: '700',
  },
  peerSpeed: {
    fontSize: 13,
    fontWeight: '700',
  },
  peerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  peerClient: {
    fontSize: 12,
  },
  peerProgress: {
    fontSize: 12,
    fontWeight: '700',
  },
});

