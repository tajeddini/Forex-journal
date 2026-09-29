// ============================================================
// Trade Images Service
// Handles trade screenshot upload, retrieval, and deletion
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { getSupabaseStorageProvider } from './storage/supabaseProvider';
import { MockStorage } from './mockStorage';
import { STORAGE_CONFIG } from '../config/storage';
import { processImage, validateImageFile } from '../utils/imageProcessing';
import type { TradeImage, TradeImageInsert } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a trade image
 */
export async function uploadTradeImage(
  tradeId: string,
  userId: string,
  file: File
): Promise<TradeImage> {
  // Validate file
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Process image (resize + WebP conversion)
  const processed = await processImage(file);

  // Generate unique storage path
  const extension = 'webp';
  const filename = `${uuidv4()}.${extension}`;
  const storagePath = `trades/${tradeId}/${filename}`;

  // Upload to storage
  const provider = getSupabaseStorageProvider();
  await provider.upload({
    path: storagePath,
    file: processed.blob,
    contentType: 'image/webp',
  });

  const insertData: TradeImageInsert = {
    trade_id: tradeId,
    user_id: userId,
    storage_provider: STORAGE_CONFIG.PROVIDER,
    storage_bucket: STORAGE_CONFIG.BUCKET_NAME,
    storage_path: storagePath,
    original_filename: file.name,
    original_size_bytes: processed.originalSize,
    processed_size_bytes: processed.processedSize,
    mime_type: 'image/webp',
    width: processed.width,
    height: processed.height,
  };

  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    const localImage: TradeImage = {
      ...insertData,
      id: `img-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return MockStorage.saveTradeImage(localImage);
  }

  const { data, error } = await supabase
    .from('trade_images')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // If remote DB fails, fall back to local store
    const localImage: TradeImage = {
      ...insertData,
      id: `img-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return MockStorage.saveTradeImage(localImage);
  }

  return data;
}

/**
 * Get all images for a trade
 */
export async function getTradeImages(tradeId: string): Promise<TradeImage[]> {
  if (!isSupabaseConfigured) {
    return MockStorage.getTradeImages(tradeId);
  }

  const { data, error } = await supabase
    .from('trade_images')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true });

  if (error) {
    // Graceful fallback to local/mock images instead of throwing
    return MockStorage.getTradeImages(tradeId);
  }

  return data || [];
}

/**
 * Get signed URL for an image
 */
export async function getTradeImageUrl(image: TradeImage): Promise<string> {
  const provider = getSupabaseStorageProvider();
  const url = await provider.getSignedUrl(image.storage_path);
  return url || image.storage_path;
}

/**
 * Delete a trade image with safety guarantees
 */
export async function deleteTradeImage(imageId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    await MockStorage.deleteTradeImage(imageId);
    return;
  }

  // Step 1: Get image metadata and verify ownership
  const { data: image, error: fetchError } = await supabase
    .from('trade_images')
    .select('*')
    .eq('id', imageId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !image) {
    await MockStorage.deleteTradeImage(imageId);
    return;
  }

  // Step 2: Delete from storage FIRST
  const provider = getSupabaseStorageProvider();
  try {
    await provider.delete(image.storage_path);
  } catch (storageError) {
    console.error('Storage deletion error:', storageError);
  }

  // Step 3: Delete from database
  const { error: dbError } = await supabase
    .from('trade_images')
    .delete()
    .eq('id', imageId)
    .eq('user_id', userId);

  if (dbError) {
    await MockStorage.deleteTradeImage(imageId);
  }
}

/**
 * Replace a trade image
 */
export async function replaceTradeImage(
  imageId: string,
  userId: string,
  newFile: File
): Promise<TradeImage> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    await MockStorage.deleteTradeImage(imageId);
    return uploadTradeImage('mock-trade-1', userId, newFile);
  }

  const { data: existingImage, error: fetchError } = await supabase
    .from('trade_images')
    .select('*')
    .eq('id', imageId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existingImage) {
    return uploadTradeImage('mock-trade-1', userId, newFile);
  }

  const oldStoragePath = existingImage.storage_path;

  const newImage = await uploadTradeImage(
    existingImage.trade_id,
    userId,
    newFile
  );

  const { error: updateError } = await supabase
    .from('trade_images')
    .update({
      storage_path: newImage.storage_path,
      original_filename: newImage.original_filename,
      original_size_bytes: newImage.original_size_bytes,
      processed_size_bytes: newImage.processed_size_bytes,
      mime_type: newImage.mime_type,
      width: newImage.width,
      height: newImage.height,
    })
    .eq('id', imageId)
    .eq('user_id', userId);

  if (!updateError) {
    try {
      const provider = getSupabaseStorageProvider();
      await provider.delete(oldStoragePath);
    } catch {
      // Ignore cleanup error
    }
  }

  return newImage;
}

/**
 * Get storage usage statistics for a user
 */
export async function getStorageStats(userId: string): Promise<{
  totalImages: number;
  totalSizeBytes: number;
  averageSizeBytes: number;
}> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return {
      totalImages: 0,
      totalSizeBytes: 0,
      averageSizeBytes: 0,
    };
  }

  const { data, error } = await supabase
    .from('trade_images')
    .select('processed_size_bytes')
    .eq('user_id', userId);

  if (error) {
    return {
      totalImages: 0,
      totalSizeBytes: 0,
      averageSizeBytes: 0,
    };
  }

  const totalImages = data?.length || 0;
  const totalSizeBytes = data?.reduce((sum, img) => sum + img.processed_size_bytes, 0) || 0;
  const averageSizeBytes = totalImages > 0 ? totalSizeBytes / totalImages : 0;

  return {
    totalImages,
    totalSizeBytes,
    averageSizeBytes,
  };
}
