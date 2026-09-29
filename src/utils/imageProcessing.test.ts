import { describe, it, expect } from 'vitest';
import { validateImageFile, formatFileSize, calculateCompressionRatio } from './imageProcessing';

describe('Image Processing Utilities', () => {
  describe('validateImageFile', () => {
    it('should accept valid JPEG file', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid PNG file', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP file', () => {
      const file = new File([''], 'test.webp', { type: 'image/webp' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject file with wrong MIME type', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('فرمت فایل پشتیبانی نمی‌شود');
    });

    it('should reject file exceeding size limit', () => {
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('حجم فایل');
    });

    it('should reject file with wrong extension', () => {
      const file = new File([''], 'test.exe', { type: 'image/jpeg' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('پسوند فایل');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('calculateCompressionRatio', () => {
    it('should calculate compression ratio correctly', () => {
      const ratio = calculateCompressionRatio(1000, 500);
      expect(ratio).toBe(50);
    });

    it('should return 0 for zero original size', () => {
      const ratio = calculateCompressionRatio(0, 500);
      expect(ratio).toBe(0);
    });

    it('should handle no compression', () => {
      const ratio = calculateCompressionRatio(1000, 1000);
      expect(ratio).toBe(0);
    });

    it('should handle high compression', () => {
      const ratio = calculateCompressionRatio(1000, 100);
      expect(ratio).toBe(90);
    });
  });
});
