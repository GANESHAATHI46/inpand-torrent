import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { DatabaseService } from '../services/DatabaseService';
import {
  TERMS_VERSION,
  TERMS_STORAGE_KEY,
  TERMS_TIMESTAMP_KEY,
  TERMS_SECTIONS,
} from '../constants/termsAndConditions';

interface TermsModalProps {
  forceVisible?: boolean;
  onAccepted?: () => void;
  onClose?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  forceVisible = false,
  onAccepted,
  onClose,
}) => {
  const { colors, spacing, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (forceVisible) {
      setIsVisible(true);
      setLoading(false);
      return;
    }

    // Check if terms have already been accepted in AsyncStorage or SQLite settings
    const checkAccepted = async () => {
      try {
        const storedAsync = await AsyncStorage.getItem(TERMS_STORAGE_KEY);
        if (storedAsync === TERMS_VERSION) {
          setIsVisible(false);
          setLoading(false);
          return;
        }

        // Check SQLite backup
        const db = DatabaseService.getInstance();
        const settings = await db.loadSettings();
        if ((settings as any).acceptedTermsVersion === TERMS_VERSION) {
          await AsyncStorage.setItem(TERMS_STORAGE_KEY, TERMS_VERSION);
          setIsVisible(false);
          setLoading(false);
          return;
        }

        // Not accepted yet
        setIsVisible(true);
      } catch (err) {
        setIsVisible(true);
      } finally {
        setLoading(false);
      }
    };

    checkAccepted();
  }, [forceVisible]);

  const handleAccept = async () => {
    if (!isChecked) return;
    try {
      await AsyncStorage.setItem(TERMS_STORAGE_KEY, TERMS_VERSION);
      await AsyncStorage.setItem(TERMS_TIMESTAMP_KEY, Date.now().toString());

      // Save to SQLite settings as permanent backup
      const db = DatabaseService.getInstance();
      const settings = await db.loadSettings();
      await db.saveSettings({
        ...settings,
        acceptedTermsVersion: TERMS_VERSION,
      } as any);
    } catch (e) {
      console.warn('Failed saving accepted terms:', e);
    }
    setIsVisible(false);
    if (onAccepted) onAccepted();
    if (onClose) onClose();
  };

  if (loading || !isVisible) {
    return null;
  }

  // Calculate safe top padding so notch and status bar clock NEVER overlap the header
  const topSafePadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20
  ) + 8;
  const bottomSafePadding = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={() => {
        if (forceVisible && onClose) {
          onClose();
        }
      }}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: topSafePadding,
            paddingBottom: bottomSafePadding,
          },
        ]}
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent={true}
          backgroundColor="transparent"
        />

        {/* Modal Header with Safe Inset Protection */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.divider,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primaryLight} />
            </View>
            <View style={styles.headerTitles}>
              <Text style={[styles.appName, { color: colors.primaryLight, fontSize: typography.sizes.caption }]}>
                INPAND TORRENT
              </Text>
              <Text style={[styles.title, { color: colors.text, fontSize: typography.sizes.h2 }]}>
                Terms & Conditions
              </Text>
            </View>
          </View>
          {forceVisible && onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Informational Notice */}
        <View
          style={[
            styles.noticeBanner,
            {
              backgroundColor: colors.surfaceVariant,
              marginHorizontal: spacing.lg,
              marginTop: spacing.sm,
              marginBottom: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: spacing.borderRadiusMd,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.primaryLight} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Please review the legal terms below carefully before continuing to the app.
          </Text>
        </View>

        {/* Scrollable Terms Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            },
          ]}
          showsVerticalScrollIndicator={true}
        >
          {TERMS_SECTIONS.map((section) => (
            <View
              key={section.id}
              style={[
                styles.sectionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.divider,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{section.content}</Text>
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom Acceptance Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.divider,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
            },
          ]}
        >
          {/* Checkbox Row */}
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.8}
            onPress={() => setIsChecked(!isChecked)}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: isChecked ? colors.primary : colors.textMuted,
                  backgroundColor: isChecked ? colors.primary : 'transparent',
                },
              ]}
            >
              {isChecked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              I have read and agree to the Terms & Conditions
            </Text>
          </TouchableOpacity>

          {/* Accept / Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: isChecked ? colors.primary : colors.surfaceVariant,
                opacity: isChecked ? 1 : 0.6,
              },
            ]}
            disabled={!isChecked}
            onPress={handleAccept}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueButtonText,
                {
                  color: isChecked ? '#FFFFFF' : colors.textMuted,
                },
              ]}
            >
              {forceVisible ? 'Close & Continue' : 'Agree & Continue'}
            </Text>
            {isChecked && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitles: {
    justifyContent: 'center',
  },
  appName: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontWeight: '800',
  },
  closeButton: {
    padding: 6,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  noticeText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  bottomBar: {
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  continueButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
