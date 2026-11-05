import { formatBytes, formatSpeed, formatEta, formatStatusLabel } from '../../src/utils/formatters';

describe('Formatters Unit Tests', () => {
  describe('formatBytes', () => {
    it('handles zero and negative bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(-100)).toBe('0 B');
    });

    it('formats bytes, KB, MB, and GB accurately', () => {
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB');
      expect(formatBytes(5368709120, 2)).toBe('5.00 GB');
    });
  });

  describe('formatSpeed', () => {
    it('formats transfer speeds correctly', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
      expect(formatSpeed(2048)).toBe('2.0 KB/s');
      expect(formatSpeed(5242880)).toBe('5.0 MB/s');
    });
  });

  describe('formatEta', () => {
    it('formats infinite or invalid seconds as infinity symbol', () => {
      expect(formatEta(-1)).toBe('∞');
    });

    it('formats completed state as Done', () => {
      expect(formatEta(0)).toBe('Done');
    });

    it('formats seconds, minutes, and hours', () => {
      expect(formatEta(45)).toBe('45s');
      expect(formatEta(130)).toBe('2m 10s');
      expect(formatEta(3720)).toBe('1h 2m');
    });
  });

  describe('formatStatusLabel', () => {
    it('returns human-readable labels', () => {
      expect(formatStatusLabel('downloading')).toBe('Downloading');
      expect(formatStatusLabel('finished')).toBe('Completed');
      expect(formatStatusLabel('paused')).toBe('Paused');
      expect(formatStatusLabel('error')).toBe('Error');
      expect(formatStatusLabel('downloading_metadata')).toBe('Fetching Metadata');
    });
  });
});

