import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme/ThemeContext';
import { useTorrentSession } from '../src/hooks/useTorrentSession';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Header } from '../src/components/Header';
import { DatabaseService } from '../src/services/DatabaseService';
import { parseTorrentBase64, ParsedTorrentMetadata } from '../src/utils/torrentParser';
import { formatBytes } from '../src/utils/formatters';

export default function AddTorrentModal() {
  const { colors, spacing, typography } = useTheme();
  const router = useRouter();
  const { engine } = useTorrentSession();

  const [magnetInput, setMagnetInput] = useState('');
  const [savePath, setSavePath] = useState('/storage/emulated/0/Download/InpandTorrent');
  const [loading, setLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedTorrentMetadata | null>(null);

  useEffect(() => {
    // 1. Load default save path
    DatabaseService.getInstance()
      .loadSettings()
      .then((s) => {
        if (s.defaultSavePath) setSavePath(s.defaultSavePath);
      })
      .catch(() => {});

    // 2. Check clipboard for magnet link on open (only on native platforms where permitted)
    if (Platform.OS !== 'web') {
      Clipboard.getStringAsync()
        .then((clip) => {
          if (clip && clip.trim().toLowerCase().startsWith('magnet:?')) {
            setMagnetInput(clip.trim());
          }
        })
        .catch(() => {
          // Gracefully ignore permission or availability errors on mount
        });
    }
  }, []);

  const handlePasteClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setMagnetInput(text.trim());
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Clipboard Permission',
          'Clipboard access was blocked by the browser or sandbox. You can paste your magnet link directly into the text box using Ctrl+V or Cmd+V.'
        );
      }
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handlePickTorrentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          '*/*',
          'application/x-bittorrent',
          'application/x-torrent',
          'application/torrent',
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        let base64 = '';
        if (Platform.OS === 'android') {
          // Native bridge safely reads content:// and file:// into memory without filesystem assumptions
          base64 = await engine.readTorrentFileBase64(file.uri);
        } else {
          // Web / JS environment
          const fileAny = file as any;
          if (fileAny.file instanceof Blob) {
            base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1] || '');
              };
              reader.onerror = reject;
              reader.readAsDataURL(fileAny.file);
            });
          } else {
            const resp = await fetch(file.uri);
            const blob = await resp.blob();
            base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1] || '');
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        }

        if (!base64) {
          throw new Error('Selected file could not be read or is empty.');
        }

        // Validate and parse metadata from raw bencoded bytes
        const parsed = parseTorrentBase64(base64);

        // Check if already exists in active session
        const existing = engine.getTorrent(parsed.infoHash);
        if (existing) {
          Alert.alert(
            'Torrent Already Added',
            `"${existing.name}" is already in your download queue.`,
            [
              { text: 'View Details', onPress: () => router.replace(`/torrent-details/${existing.infoHash}`) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }

        setSelectedFileName(parsed.name || file.name);
        setSelectedFileBase64(base64);
        setParsedPreview(parsed);
        setMagnetInput(''); // Clear magnet if picking file
      }
    } catch (e: any) {
      Alert.alert('Torrent File Error', `Could not read or parse torrent: ${e?.message || e}`);
    }
  };

  const handleStartDownload = async () => {
    if (!magnetInput.trim() && !selectedFileBase64) {
      Alert.alert('Input Required', 'Please enter a magnet URI or pick a .torrent file.');
      return;
    }

    setLoading(true);
    try {
      if (selectedFileBase64 && selectedFileName) {
        const torrent = await engine.addTorrentFile(selectedFileBase64, selectedFileName, savePath);
        Alert.alert(
          'Download Started',
          `"${torrent.name}" has been queued for download.`,
          [{ text: 'OK', onPress: () => router.replace(`/torrent-details/${torrent.infoHash}`) }]
        );
      } else {
        const torrent = await engine.addMagnet(magnetInput.trim(), savePath);
        Alert.alert(
          'Download Started',
          `"${torrent.name}" has been queued for download.`,
          [{ text: 'OK', onPress: () => router.replace(`/torrent-details/${torrent.infoHash}`) }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error Adding Torrent', err?.message || 'Could not add torrent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header
        title="Add Torrent"
        subtitle="Download via Magnet URI or .torrent file"
        showBack
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Magnet Link Input Section */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>MAGNET LINK</Text>
        <Card style={{ marginTop: spacing.xs }}>
          <TextInput
            placeholder="Paste magnet:?xt=urn:btih:... URI here"
            placeholderTextColor={colors.textMuted}
            value={magnetInput}
            onChangeText={(txt) => {
              setMagnetInput(txt);
              if (txt) {
                setSelectedFileName(null);
                setSelectedFileBase64(null);
              }
            }}
            multiline
            numberOfLines={4}
            style={[
              styles.textArea,
              {
                color: colors.text,
                backgroundColor: colors.surfaceVariant,
                borderRadius: spacing.borderRadiusMd,
                padding: spacing.md,
              },
            ]}
          />

          <View style={[styles.inputActionsRow, { marginTop: spacing.sm }]}>
            <Button
              title="Paste from Clipboard"
              variant="secondary"
              size="sm"
              onPress={handlePasteClipboard}
              icon={<Ionicons name="clipboard-outline" size={16} color={colors.text} />}
            />
            {magnetInput ? (
              <TouchableOpacity
                onPress={() => setMagnetInput('')}
                style={[styles.clearBtn, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        {/* OR Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.line, { backgroundColor: colors.divider }]} />
          <Text style={[styles.orText, { color: colors.textMuted }]}>OR PICK A FILE</Text>
          <View style={[styles.line, { backgroundColor: colors.divider }]} />
        </View>

        {/* .torrent File Picker Card */}
        <Card>
          <View style={styles.filePickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fileTitle, { color: colors.text }]}>.torrent File</Text>
              <Text style={[styles.fileSubtitle, { color: colors.textSecondary }]}>
                {selectedFileName || 'No .torrent file selected'}
              </Text>
            </View>
            <Button
              title={selectedFileName ? 'Change' : 'Choose File'}
              variant="outline"
              size="sm"
              onPress={handlePickTorrentFile}
              icon={<Ionicons name="document-attach-outline" size={16} color={colors.primaryLight} />}
            />
          </View>

          {parsedPreview ? (
            <View
              style={{
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.textSecondary }}>Size:</Text>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.text, fontWeight: '600' }}>
                  {formatBytes(parsedPreview.totalSize)} ({parsedPreview.files.length} file{parsedPreview.files.length === 1 ? '' : 's'})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.textSecondary }}>Pieces:</Text>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.text }}>
                  {parsedPreview.numPieces} × {formatBytes(parsedPreview.pieceLength)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.textSecondary }}>Trackers:</Text>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.text }}>
                  {parsedPreview.trackers.length} configured
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.textSecondary }}>Info Hash:</Text>
                <Text style={{ fontSize: typography.sizes.caption, color: colors.primaryLight, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  {parsedPreview.infoHash.slice(0, 16)}...
                </Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Download Location */}
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>
          DOWNLOAD DESTINATION
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={styles.folderRow}>
            <Ionicons name="folder-outline" size={20} color={colors.primaryLight} style={{ marginRight: 8 }} />
            <TextInput
              value={savePath}
              onChangeText={setSavePath}
              style={[
                styles.pathInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: spacing.borderRadiusMd,
                  paddingHorizontal: spacing.md,
                },
              ]}
            />
          </View>
        </Card>

        {/* Submit Button */}
        <Button
          title={loading ? 'Processing Torrent...' : 'Start Download'}
          onPress={handleStartDownload}
          loading={loading}
          disabled={loading || (!magnetInput.trim() && !selectedFileBase64)}
          size="lg"
          style={{ marginTop: spacing.xl }}
          icon={!loading ? <Ionicons name="cloud-download" size={20} color="#FFFFFF" /> : undefined}
        />
      </ScrollView>
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  inputActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  line: {
    flex: 1,
    height: 1,
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  filePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
  },
});
