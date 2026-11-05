import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { TorrentItem } from '../types/torrent';
import { formatBytes } from '../utils/formatters';

interface DeleteTorrentModalProps {
  visible: boolean;
  torrent: TorrentItem | null;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => Promise<void>;
}

export function DeleteTorrentModal({
  visible,
  torrent,
  onClose,
  onConfirm,
}: DeleteTorrentModalProps) {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'none' | 'files'>('none');

  if (!torrent) return null;

  const handleExecuteDelete = async (deleteFiles: boolean) => {
    if (loading) return;
    setLoading(true);
    setDeleteMode(deleteFiles ? 'files' : 'none');
    try {
      await onConfirm(deleteFiles);
      onClose();
    } catch (err) {
      console.error('DeleteTorrentModal error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={loading ? undefined : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                  padding: spacing.lg,
                  borderRadius: spacing.borderRadiusLg,
                },
              ]}
            >
              {/* Header Icon & Title */}
              <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
                  <Ionicons name="trash" size={24} color={colors.danger} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[styles.title, { color: colors.text, fontSize: typography.sizes.title }]}>
                    Remove Torrent
                  </Text>
                  <Text
                    style={[styles.torrentName, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {torrent.name}
                  </Text>
                  <Text style={[styles.torrentMeta, { color: colors.textMuted }]}>
                    Size: {formatBytes(torrent.totalSize)} • Status: {torrent.status}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.description, { color: colors.textSecondary, marginVertical: spacing.md }]}>
                Choose how you want to remove this torrent. You can keep the downloaded files on your device or permanently delete them.
              </Text>

              {/* Action Buttons */}
              <View style={styles.actionsCol}>
                {/* Mode A: Remove Torrent Only */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: colors.surfaceVariant,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  onPress={() => handleExecuteDelete(false)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading && deleteMode === 'none' ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={20} color={colors.text} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.btnTitle, { color: colors.text }]}>
                          Remove Torrent Only
                        </Text>
                        <Text style={[styles.btnSub, { color: colors.textMuted }]}>
                          Keeps downloaded files on storage
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Mode B: Remove Torrent and Downloaded Files */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      borderColor: colors.danger,
                      marginTop: spacing.sm,
                    },
                  ]}
                  onPress={() => handleExecuteDelete(true)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  {loading && deleteMode === 'files' ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-bin-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.btnTitle, { color: colors.danger }]}>
                          Remove & Delete Files
                        </Text>
                        <Text style={[styles.btnSub, { color: colors.danger, opacity: 0.8 }]}>
                          Permanently purges files from storage
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={[styles.cancelBtn, { marginTop: spacing.md }]}
                  onPress={onClose}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
  },
  torrentName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  torrentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsCol: {
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnSub: {
    fontSize: 11,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

