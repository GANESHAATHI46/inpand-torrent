import { useEffect, useState, useCallback } from 'react';
import { TorrentEngine } from '../services/TorrentEngine';
import { TorrentItem, DashboardStats } from '../types/torrent';

export function useTorrentSession() {
  const engine = TorrentEngine.getInstance();
  const [torrents, setTorrents] = useState<TorrentItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTorrents: 0,
    activeDownloads: 0,
    completedDownloads: 0,
    pausedDownloads: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    overallProgress: 0,
    totalSize: 0,
    totalDownloaded: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      await engine.initialize();
      unsubscribe = engine.subscribe((list, dashboardStats) => {
        setTorrents([...list]);
        setStats({ ...dashboardStats });
        setLoading(false);
      });
    }

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const pauseTorrent = useCallback((infoHash: string) => engine.pauseTorrent(infoHash), []);
  const resumeTorrent = useCallback((infoHash: string) => engine.resumeTorrent(infoHash), []);
  const removeTorrent = useCallback((infoHash: string, deleteFiles?: boolean) => engine.removeTorrent(infoHash, deleteFiles), []);
  const pauseAll = useCallback(() => engine.pauseAll(), []);
  const resumeAll = useCallback(() => engine.resumeAll(), []);

  return {
    torrents,
    stats,
    loading,
    engine,
    pauseTorrent,
    resumeTorrent,
    removeTorrent,
    pauseAll,
    resumeAll,
  };
}

