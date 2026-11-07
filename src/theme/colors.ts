/**
 * Inpand Torrent Color Palette
 * Clean, professional dark and light themes inspired by modern native Android (Material 3 & Slate).
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  divider: string;
  statusBar: 'light' | 'dark';
  speedDown: string;
  speedUp: string;
  progressBarBg: string;
}

export const darkColors: ThemeColors = {
  background: '#0B0F19',
  surface: '#111827',
  surfaceVariant: '#1F2937',
  card: '#151D2F',
  cardBorder: '#23304B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#0284C7',
  primaryLight: '#38BDF8',
  primaryDark: '#0369A1',
  accent: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  divider: '#1E293B',
  statusBar: 'light',
  speedDown: '#38BDF8',
  speedUp: '#34D399',
  progressBarBg: '#1E293B',
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#0284C7',
  primaryLight: '#38BDF8',
  primaryDark: '#0369A1',
  accent: '#0891B2',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  divider: '#E2E8F0',
  statusBar: 'dark',
  speedDown: '#0284C7',
  speedUp: '#059669',
  progressBarBg: '#E2E8F0',
};

