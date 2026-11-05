import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { TorrentEngine, IncomingTorrentIntent } from '../services/TorrentEngine';

/**
 * Hook that listens for incoming .torrent files and magnet URIs
 * triggered from Android file associations, third-party apps,
 * share intents, or deep links.
 */
export function useTorrentIntentListener() {
  const router = useRouter();
  const engine = TorrentEngine.getInstance();
  const processedKeys = useRef<Map<string, number>>(new Map());

  const isDuplicate = (key: string): boolean => {
    const now = Date.now();
    const lastTime = processedKeys.current.get(key);
    if (lastTime && now - lastTime < 2000) {
      return true;
    }
    processedKeys.current.set(key, now);
    return false;
  };

  const handleIntent = async (intent: IncomingTorrentIntent) => {
    if (!intent || !intent.type) return;

    if (intent.type === 'magnet') {
      const uri = intent.uri?.trim();
      if (!uri) return;
      if (isDuplicate(uri)) return;

      const match = uri.match(/xt=urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      const hash = match ? match[1].toLowerCase() : null;

      if (hash) {
        const existing = engine.getTorrent(hash);
        if (existing) {
          Alert.alert(
            'Torrent Already Added',
            `"${existing.name}" is already in your download list.`,
            [
              { text: 'View', onPress: () => router.push(`/torrent-details/${hash}`) },
              { text: 'OK', style: 'cancel' },
            ]
          );
          return;
        }
      }

      try {
        const item = await engine.addMagnet(uri);
        Alert.alert(
          'Torrent Added',
          `"${item.name}" has been queued for download.`,
          [
            { text: 'View Details', onPress: () => router.push(`/torrent-details/${item.infoHash}`) },
            { text: 'OK' },
          ]
        );
        router.push(`/torrent-details/${item.infoHash}`);
      } catch (err: any) {
        Alert.alert('Error Adding Magnet', err?.message || 'Could not parse magnet link.');
      }
    } else if (intent.type === 'torrent_file') {
      const filePath = intent.filePath;
      if (!filePath) return;
      if (isDuplicate(filePath)) return;

      try {
        const base64 = await engine.readTorrentFileBase64(filePath);
        const fileName = intent.fileName || 'incoming.torrent';
        const item = await engine.addTorrentFile(base64, fileName);

        Alert.alert(
          'Torrent Added',
          `"${item.name}" has been added to your downloads.`,
          [
            { text: 'View Details', onPress: () => router.push(`/torrent-details/${item.infoHash}`) },
            { text: 'OK' },
          ]
        );
        router.push(`/torrent-details/${item.infoHash}`);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('already in the download list') || msg.includes('already added')) {
          Alert.alert('Torrent Already Added', 'This torrent is already in your download list.');
        } else {
          Alert.alert(
            'Corrupted Torrent File',
            `Unable to process .torrent file: ${msg}\nPlease ensure the file is valid and uncorrupted.`
          );
        }
      }
    } else if (intent.type === 'torrent_files_multiple' && intent.files) {
      const key = `batch_${intent.files.length}_${Date.now()}`;
      if (isDuplicate(key)) return;

      let addedCount = 0;
      for (const file of intent.files) {
        try {
          const base64 = await engine.readTorrentFileBase64(file.filePath);
          await engine.addTorrentFile(base64, file.fileName || 'incoming.torrent');
          addedCount++;
        } catch (e) {
          console.warn('Failed adding torrent from multiple batch:', file.fileName, e);
        }
      }

      Alert.alert(
        'Batch Torrents Added',
        `Successfully added ${addedCount} of ${intent.files.length} torrent files.`,
        [
          { text: 'View Downloads', onPress: () => router.push('/(tabs)/downloads') },
          { text: 'OK' },
        ]
      );
      router.push('/(tabs)/downloads');
    }
  };

  useEffect(() => {
    let unsubscribeIntent: (() => void) | undefined;
    let linkingSub: { remove: () => void } | undefined;

    async function setupListeners() {
      // 1. Ensure engine is initialized
      await engine.initialize();

      // 2. Check for cold-start initial torrent from native IntentHandler
      if (Platform.OS === 'android') {
        const initial = await engine.getInitialTorrent();
        if (initial) {
          handleIntent(initial);
        }

        // 3. Listen for runtime incoming intents while app is running/backgrounded
        unsubscribeIntent = engine.addIntentListener((payload) => {
          handleIntent(payload);
        });
      }

      // 4. Fallback to Expo Linking for magnet: URLs
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.toLowerCase().startsWith('magnet:?')) {
          handleIntent({ type: 'magnet', uri: initialUrl });
        }
      } catch (e) {
        console.warn('Linking.getInitialURL error:', e);
      }

      linkingSub = Linking.addEventListener('url', (event) => {
        if (event.url && event.url.toLowerCase().startsWith('magnet:?')) {
          handleIntent({ type: 'magnet', uri: event.url });
        }
      });
    }

    setupListeners();

    return () => {
      if (unsubscribeIntent) unsubscribeIntent();
      if (linkingSub) linkingSub.remove();
    };
  }, []);
}

