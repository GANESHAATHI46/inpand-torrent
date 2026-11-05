import { useRef, useCallback } from 'react';
import { ScrollView, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useScrollToTop } from '@react-navigation/native';

/**
 * Hook to reset scroll position to the top whenever a tab receives focus,
 * and also when the user taps on the already active tab in the bottom bar.
 *
 * Supports both ScrollView and FlatList components.
 */
export function useTabScrollReset<T extends ScrollView | FlatList>() {
  const ref = useRef<T | null>(null);

  // useScrollToTop scrolls to top with animation when tapping the active tab icon
  useScrollToTop(ref as any);

  // useFocusEffect resets scroll position when navigating to this tab from another tab
  useFocusEffect(
    useCallback(() => {
      if (!ref.current) return;
      const scrollable = ref.current as any;
      if (typeof scrollable.scrollToOffset === 'function') {
        // FlatList
        scrollable.scrollToOffset({ offset: 0, animated: false });
      } else if (typeof scrollable.scrollTo === 'function') {
        // ScrollView
        scrollable.scrollTo({ y: 0, animated: false });
      }
    }, [])
  );

  return ref;
}

