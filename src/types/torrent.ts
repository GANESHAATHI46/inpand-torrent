export type TorrentStatus =
  | 'checking'
  | 'downloading_metadata'
  | 'downloading'
  | 'finished'
  | 'seeding'
  | 'allocating'
  | 'checking_resume_data'
  | 'paused'
  | 'error';

export type FilePriority = 0 | 1 | 4 | 7;

export interface TorrentFile {
  index: number;
  path: string;
  size: number;
  offset: number;
  downloadedBytes: number;
  priority: FilePriority;
  progress: number;
}

export interface Tracker {
  url: string;
  tier: number;
  status: string;
  peers: number;
  seeds: number;
  message?: string;
}

export interface Peer {
  ip: string;
  port: number;
  client: string;
  downloadRate: number;
  uploadRate: number;
  progress: number;
  flags: string;
}

export interface TorrentItem {
  infoHash: string;
  name: string;
  status: TorrentStatus;
  totalSize: number;
  downloadedBytes: number;
  uploadedBytes: number;
  downloadRate: number;
  uploadRate: number;
  progress: number;
  eta: number; // in seconds, -1 if unavailable
  numSeeds: number;
  numPeers: number;
  totalSeeds: number;
  totalPeers: number;
  savePath: string;
  addedDate: number;
  completedDate?: number | null;
  pieceLength: number;
  numPieces: number;
  piecesProgress?: string | null;
  errorMessage?: string | null;
  files: TorrentFile[];
  trackers: Tracker[];
  peers: Peer[];
}

export interface DashboardStats {
  totalTorrents: number;
  activeDownloads: number;
  completedDownloads: number;
  pausedDownloads: number;
  downloadSpeed: number;
  uploadSpeed: number;
  overallProgress: number;
  totalSize: number;
  totalDownloaded: number;
}

export interface SessionSettings {
  downloadRateLimit: number; // bytes/sec, 0 = unlimited
  uploadRateLimit: number;
  maxActiveDownloads: number;
  maxActiveUploads: number;
  maxConnections: number;
  dhtEnabled: boolean;
  pexEnabled: boolean;
  lsdEnabled: boolean;
  wifiOnly: boolean;
  mobileDataWarning: boolean;
  listenPort: number;
  defaultSavePath: string;
  darkMode: boolean;
}

