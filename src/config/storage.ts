// ============================================================
// Storage Configuration
// Centralized configuration for image storage and processing
// ============================================================

export const STORAGE_CONFIG = {
  // Supabase Storage bucket name
  BUCKET_NAME: 'trade-screenshots',
  
  // Storage provider
  PROVIDER: 'supabase',
  
  // Maximum upload size in bytes (10 MB)
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024,
  
  // Maximum image dimensions
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1920,
  
  // WebP quality (0-100)
  WEBP_QUALITY: 80,
  
  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  
  // Allowed file extensions
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  
  // Signed URL expiration in seconds (1 hour)
  SIGNED_URL_EXPIRY: 3600,
} as const;

// Environment variable helpers
export function getStorageConfig() {
  return {
    ...STORAGE_CONFIG,
    // Allow environment variable overrides
    MAX_UPLOAD_SIZE: Number(import.meta.env.VITE_MAX_UPLOAD_SIZE) || STORAGE_CONFIG.MAX_UPLOAD_SIZE,
    MAX_WIDTH: Number(import.meta.env.VITE_MAX_IMAGE_WIDTH) || STORAGE_CONFIG.MAX_WIDTH,
    MAX_HEIGHT: Number(import.meta.env.VITE_MAX_IMAGE_HEIGHT) || STORAGE_CONFIG.MAX_HEIGHT,
    WEBP_QUALITY: Number(import.meta.env.VITE_WEBP_QUALITY) || STORAGE_CONFIG.WEBP_QUALITY,
  };
}
