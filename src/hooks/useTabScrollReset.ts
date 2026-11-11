import { useRef, useCallback, useEffect } from 'react';
import { ScrollView, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from 'expo-router';

export type ScrollViewRef = React.ComponentRef<typeof ScrollView>;
export type FlatListRef = React.ComponentRef<typeof FlatList>;
export type ScrollableComponent = ScrollViewRef | FlatListRef;

/**
 * Hook to reset scroll position to the top whenever a tab receives focus,
 * and also when the user taps on the already active tab in the bottom bar.
 *
 * Supports both ScrollView and FlatList components without requiring route context.
 */
export function useTabScrollReset<T extends ScrollableComponent = ScrollViewRef>() {
  const ref = useRef<T | null>(null);
  const navigation = useNavigation();

  // Scroll to top when tapping the active tab icon
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;

    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (!ref.current) return;
      const scrollable = ref.current as any;
      if (typeof scrollable.scrollToOffset === 'function') {
        scrollable.scrollToOffset({ offset: 0, animated: true });
      } else if (typeof scrollable.scrollTo === 'function') {
        scrollable.scrollTo({ y: 0, animated: true });
      } else if (typeof scrollable.scrollToTop === 'function') {
        scrollable.scrollToTop();
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Reset scroll position when navigating to this tab from another tab
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
      } else if (typeof scrollable.scrollToTop === 'function') {
        scrollable.scrollToTop();
      }
    }, [])
  );

  return ref;
}
