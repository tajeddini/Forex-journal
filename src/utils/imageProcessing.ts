// ============================================================
// Image Processing Utilities
// Client-side image optimization (WebP conversion, resize)
// ============================================================

import { getStorageConfig } from '../config/storage';

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

/**
 * Process an image: resize if needed and convert to WebP
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const config = getStorageConfig();
  const originalSize = file.size;

  // Load image
  const img = await loadImage(file);

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    config.MAX_WIDTH,
    config.MAX_HEIGHT
  );

  // Draw to canvas with new dimensions
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('خطا در پردازش تصویر');
  }

  // Use high quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to WebP
  const blob = await canvasToBlob(canvas, 'image/webp', config.WEBP_QUALITY / 100);

  return {
    blob,
    width,
    height,
    originalSize,
    processedSize: blob.size,
  };
}

/**
 * Load an image from File
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('خطا در بارگذاری تصویر'));
    };

    img.src = url;
  });
}

/**
 * Calculate new dimensions while preserving aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // If image is smaller than max dimensions, keep original size
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Resize based on which dimension exceeds the limit
  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / aspectRatio);
  }

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return { width, height };
}

/**
 * Convert canvas to Blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('خطا در تبدیل تصویر'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const config = getStorageConfig();

  // Check file size
  if (file.size > config.MAX_UPLOAD_SIZE) {
    const maxSizeMB = Math.round(config.MAX_UPLOAD_SIZE / (1024 * 1024));
    return {
      valid: false,
      error: `حجم فایل نباید بیشتر از ${maxSizeMB} مگابایت باشد`,
    };
  }

  // Check MIME type
  if (!(config.ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: 'فرمت فایل پشتیبانی نمی‌شود. فقط JPEG، PNG و WebP مجاز هستند',
    };
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!(config.ALLOWED_EXTENSIONS as readonly string[]).includes(extension || '')) {
    return {
      valid: false,
      error: 'پسوند فایل معتبر نیست',
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(originalSize: number, processedSize: number): number {
  if (originalSize === 0) return 0;
  return ((originalSize - processedSize) / originalSize) * 100;
}
