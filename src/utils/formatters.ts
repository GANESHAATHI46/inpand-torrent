import { TorrentStatus } from '../types/torrent';

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (seconds === -1 || seconds === undefined || seconds === null) return '∞';
  if (seconds <= 0) return 'Done';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatStatusLabel(status: TorrentStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking Files';
    case 'downloading_metadata':
      return 'Fetching Metadata';
    case 'downloading':
      return 'Downloading';
    case 'finished':
      return 'Completed';
    case 'seeding':
      return 'Seeding';
    case 'allocating':
      return 'Allocating Disk';
    case 'checking_resume_data':
      return 'Checking Resume';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

