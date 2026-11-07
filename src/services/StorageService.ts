import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async getAvailableDiskSpace(): Promise<{ free: number; total: number }> {
    try {
      const free = Paths.availableDiskSpace || 32 * 1024 * 1024 * 1024;
      const total = Paths.totalDiskSpace || 128 * 1024 * 1024 * 1024;
      return { free, total };
    } catch {
      return { free: 32 * 1024 * 1024 * 1024, total: 128 * 1024 * 1024 * 1024 };
    }
  }

  public getDefaultDownloadDir(): string {
    if (Platform.OS === 'android') {
      return '/storage/emulated/0/Download/InpandTorrent';
    }
    try {
      return `${Paths.document.uri}downloads`;
    } catch {
      return '/storage/emulated/0/Download/InpandTorrent';
    }
  }
}
