import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface CompressionOptions {
  enabled: boolean;
  threshold: number; // Minimum size in bytes to compress
  level: number; // Compression level 1-9
}

export class CompressionManager {
  private options: CompressionOptions = {
    enabled: true,
    threshold: 1024, // 1KB threshold
    level: 6, // Balanced compression level
  };

  /**
   * Update compression options
   */
  updateOptions(options: Partial<CompressionOptions>): void {
    this.options = { ...this.options, ...options };
    logger.info('Updated compression options', this.options);
  }

  /**
   * Check if data should be compressed
   */
  private shouldCompress(data: string): boolean {
    if (!this.options.enabled) return false;
    return Buffer.byteLength(data, 'utf8') >= this.options.threshold;
  }

  /**
   * Compress data if it meets threshold
   */
  async compress(data: any): Promise<{ data: any; compressed: boolean; originalSize: number; compressedSize?: number }> {
    const jsonString = JSON.stringify(data);
    const originalSize = Buffer.byteLength(jsonString, 'utf8');

    if (!this.shouldCompress(jsonString)) {
      return {
        data: jsonString,
        compressed: false,
        originalSize,
      };
    }

    try {
      const compressedBuffer = await gzipAsync(jsonString, { level: this.options.level });
      const compressedData = compressedBuffer.toString('base64');
      const compressedSize = Buffer.byteLength(compressedData, 'utf8');

      logger.debug('Data compressed', {
        originalSize,
        compressedSize,
        ratio: (compressedSize / originalSize * 100).toFixed(1) + '%',
      });

      return {
        data: compressedData,
        compressed: true,
        originalSize,
        compressedSize,
      };
    } catch (error) {
      logger.warn('Compression failed, storing uncompressed:', error);
      return {
        data: jsonString,
        compressed: false,
        originalSize,
      };
    }
  }

  /**
   * Decompress data if it was compressed
   */
  async decompress(data: string, wasCompressed: boolean): Promise<any> {
    if (!wasCompressed) {
      return JSON.parse(data);
    }

    try {
      const compressedBuffer = Buffer.from(data, 'base64');
      const decompressedBuffer = await gunzipAsync(compressedBuffer);
      const decompressedString = decompressedBuffer.toString('utf8');
      return JSON.parse(decompressedString);
    } catch (error) {
      logger.error('Decompression failed:', error);
      throw new Error('Failed to decompress cached data');
    }
  }

  /**
   * Create cache metadata
   */
  createCacheMetadata(compressed: boolean, originalSize: number, compressedSize?: number) {
    return {
      compressed,
      originalSize,
      compressedSize,
      timestamp: Date.now(),
      version: '1.0',
    };
  }

  /**
   * Get compression statistics
   */
  getStats() {
    return {
      enabled: this.options.enabled,
      threshold: this.options.threshold,
      level: this.options.level,
    };
  }
}

// Export singleton instance
export const compressionManager = new CompressionManager();