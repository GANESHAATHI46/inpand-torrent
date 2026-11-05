import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, darkColors, lightColors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  spacing: typeof spacing;
  typography: typeof typography;
}

const THEME_STORAGE_KEY = '@torrentflow_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  colors: darkColors,
  isDark: true,
  themeMode: 'system',
  setThemeMode: () => {},
  spacing,
  typography,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setThemeModeState(saved as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark,
        themeMode,
        setThemeMode,
        spacing,
        typography,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

