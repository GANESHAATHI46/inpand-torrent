import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { DatabaseService } from '../../src/services/DatabaseService';
import { StorageService } from '../../src/services/StorageService';
import { SessionSettings } from '../../src/types/torrent';
import { formatBytes } from '../../src/utils/formatters';
import { useTabScrollReset } from '../../src/hooks/useTabScrollReset';

export default function SettingsScreen() {
  const { colors, spacing, typography, themeMode, setThemeMode, isDark } = useTheme();
  const db = DatabaseService.getInstance();
  const router = useRouter();
  const scrollRef = useTabScrollReset();

  const [settings, setSettings] = useState<SessionSettings>({
    downloadRateLimit: 0,
    uploadRateLimit: 0,
    maxActiveDownloads: 5,
    maxActiveUploads: 5,
    maxConnections: 200,
    dhtEnabled: true,
    pexEnabled: true,
    lsdEnabled: true,
    wifiOnly: false,
    mobileDataWarning: true,
    listenPort: 6881,
    defaultSavePath: '/storage/emulated/0/Download/InpandTorrent',
    darkMode: true,
  });

  const [diskSpace, setDiskSpace] = useState({ free: 0, total: 0 });
  const [downloadLimitInput, setDownloadLimitInput] = useState('0');
  const [uploadLimitInput, setUploadLimitInput] = useState('0');

  useEffect(() => {
    db.loadSettings().then((s) => {
      setSettings(s);
      setDownloadLimitInput(String(Math.round(s.downloadRateLimit / 1024)));
      setUploadLimitInput(String(Math.round(s.uploadRateLimit / 1024)));
    });
    StorageService.getInstance().getAvailableDiskSpace().then(setDiskSpace);
  }, []);

  const handleSaveSetting = async <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await db.saveSettings(updated);
  };

  const handleApplyLimits = async () => {
    const dlBytes = (parseInt(downloadLimitInput, 10) || 0) * 1024;
    const ulBytes = (parseInt(uploadLimitInput, 10) || 0) * 1024;
    const updated = {
      ...settings,
      downloadRateLimit: dlBytes,
      uploadRateLimit: ulBytes,
    };
    setSettings(updated);
    await db.saveSettings(updated);
    Alert.alert('Settings Saved', 'Speed limit settings have been updated.');
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
              Settings
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}>
        {/* Network & Transfer Rules */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight }]}>NETWORK & TRANSFERS</Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Download on Wi-Fi Only</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Pause active transfers when mobile data is in use
              </Text>
            </View>
            <Switch
              value={settings.wifiOnly}
              onValueChange={(val) => handleSaveSetting('wifiOnly', val)}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Mobile Data Warning</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Alert before starting downloads over cellular networks
              </Text>
            </View>
            <Switch
              value={settings.mobileDataWarning}
              onValueChange={(val) => handleSaveSetting('mobileDataWarning', val)}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Speed Limits */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          SPEED LIMITS (KB/s)
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={[styles.inputRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Max Download Speed</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>0 = Unlimited</Text>
            </View>
            <TextInput
              keyboardType="numeric"
              value={downloadLimitInput}
              onChangeText={setDownloadLimitInput}
              style={[
                styles.numberInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderColor: colors.cardBorder,
                },
              ]}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Max Upload Speed</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>0 = Unlimited</Text>
            </View>
            <TextInput
              keyboardType="numeric"
              value={uploadLimitInput}
              onChangeText={setUploadLimitInput}
              style={[
                styles.numberInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderColor: colors.cardBorder,
                },
              ]}
            />
          </View>

          <Button
            title="Save Speed Limits"
            onPress={handleApplyLimits}
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Peer Discovery & Engine Protocols */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          P2P PROTOCOLS
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Enable DHT (Mainline)</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Decentralized trackerless peer discovery
              </Text>
            </View>
            <Switch
              value={settings.dhtEnabled}
              onValueChange={(val) => handleSaveSetting('dhtEnabled', val)}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Enable Peer Exchange (PEX)</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Exchange peer lists with connected clients
              </Text>
            </View>
            <Switch
              value={settings.pexEnabled}
              onValueChange={(val) => handleSaveSetting('pexEnabled', val)}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelCol}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Local Service Discovery (LSD)</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                Discover peer nodes on local subnet / Wi-Fi
              </Text>
            </View>
            <Switch
              value={settings.lsdEnabled}
              onValueChange={(val) => handleSaveSetting('lsdEnabled', val)}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Storage Location */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          STORAGE & DIRECTORY
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={styles.storageLocRow}>
            <Ionicons name="folder" size={20} color={colors.primaryLight} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Default Download Folder</Text>
              <Text style={[styles.settingSub, { color: colors.textSecondary, marginTop: 2 }]}>
                {settings.defaultSavePath}
              </Text>
            </View>
          </View>
          <View style={[styles.diskSpaceRow, { borderTopColor: colors.divider, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
            <Text style={[styles.settingSub, { color: colors.textMuted }]}>
              Available space: {formatBytes(diskSpace.free)}
            </Text>
          </View>
        </Card>

        {/* Appearance */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          APPEARANCE
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <View style={styles.themeRow}>
            {(['system', 'dark', 'light'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setThemeMode(m)}
                style={[
                  styles.themeTab,
                  {
                    backgroundColor: themeMode === m ? colors.primary : colors.surfaceVariant,
                    borderRadius: spacing.borderRadiusMd,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.themeTabText,
                    { color: themeMode === m ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.settingSub, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {themeMode === 'system'
              ? `System Default (currently ${isDark ? 'Dark' : 'Light'})`
              : themeMode === 'dark'
              ? 'Dark theme active'
              : 'Light theme active'}
          </Text>
        </Card>

        {/* Legal & Policies */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          LEGAL & POLICIES
        </Text>
        <Card style={{ marginTop: spacing.xs }}>
          <TouchableOpacity
            style={[styles.legalRow, { borderBottomColor: colors.divider }]}
            onPress={() => router.push('/terms' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.legalIconLabel}>
              <Ionicons name="document-text-outline" size={20} color={colors.primaryLight} style={{ marginRight: 12 }} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>Terms & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.legalRow, { borderBottomColor: colors.divider }]}
            onPress={() => router.push('/privacy' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.legalIconLabel}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} style={{ marginRight: 12 }} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalRowLast}
            onPress={() => router.push('/licenses' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.legalIconLabel}>
              <Ionicons name="code-slash-outline" size={20} color={colors.accent} style={{ marginRight: 12 }} />
              <Text style={[styles.settingTitle, { color: colors.text }]}>Open Source Licenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Application & Handover Details */}
        <Text style={[styles.groupTitle, { color: colors.primaryLight, marginTop: spacing.lg }]}>
          ABOUT INPAND TORRENT
        </Text>
        <Card style={{ marginTop: spacing.xs, marginBottom: spacing.xl, alignItems: 'center', paddingVertical: spacing.lg }}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={{ width: 72, height: 72, marginBottom: spacing.sm }}
            resizeMode="contain"
          />
          <Text style={[styles.settingTitle, { color: colors.text, fontSize: typography.sizes.h2, fontWeight: '800' }]}>
            Inpand Torrent
          </Text>
          <Text style={[styles.settingSub, { color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 300 }]}>
            Production BitTorrent client for Android with libtorrent 2.1.x C++ engine and background foreground service.
          </Text>
          <View style={{ width: '100%', marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md }}>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>Version: 1.0.0 (Release Build)</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>Package: com.torrentflow.mobile</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>Target SDK: Android 14 / API 34</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>Native ABI: arm64-v8a</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>Protocol: BitTorrent 2.1.x / DHT / PEX / LSD</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  content: {
    paddingBottom: 96,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLabelCol: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  numberInput: {
    width: 90,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
  storageLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diskSpaceRow: {
    borderTopWidth: 1,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  themeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  legalRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  legalIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

