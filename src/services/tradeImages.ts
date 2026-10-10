// ============================================================
// Trade Images Service
// Handles trade screenshot upload, retrieval, deletion & replacement
// with atomic rollback guarantees and zero silent mock fallbacks
// ============================================================

import { supabase, isSupabaseConfigured } from './supabase';
import { getSupabaseStorageProvider } from './storage/supabaseProvider';
import { MockStorage } from './mockStorage';
import { STORAGE_CONFIG } from '../config/storage';
import { processImage, validateImageFile } from '../utils/imageProcessing';
import type { TradeImage, TradeImageInsert } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/** Convert a processed image blob to a data URL for the browser-only guest demo. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunk the conversion to avoid argument limits on larger screenshots.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const base64 = btoa(binary);
  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}

/**
 * Upload a trade image with rollback on DB failure
 */
export async function uploadTradeImage(
  tradeId: string,
  userId: string,
  file: File
): Promise<TradeImage> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Process image (resize + WebP conversion)
  const processed = await processImage(file);

  // Generate unique storage path
  const filename = `${uuidv4()}.webp`;
  const storagePath = `trades/${tradeId}/${filename}`;

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
    // Keep the processed preview in mock storage so guest screenshots still render
    // after navigation/reload without requesting a signed URL for a non-existent cloud object.
    const previewUrl = await blobToDataUrl(processed.blob);
    const localImage: TradeImage & { preview_url: string } = {
      ...insertData,
      preview_url: previewUrl,
      id: `img-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return MockStorage.saveTradeImage(localImage);
  }

  // Verify trade exists and belongs to the authenticated user before uploading
  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .select('user_id')
    .eq('id', tradeId)
    .single();

  if (tradeError || !trade || trade.user_id !== userId) {
    throw new Error('عدم دسترسی: معامله یافت نشد یا متعلق به شما نیست');
  }

  // Upload to storage
  const provider = getSupabaseStorageProvider();
  await provider.upload({
    path: storagePath,
    file: processed.blob,
    contentType: 'image/webp',
  });

  // Insert metadata into DB; if fails, roll back storage upload!
  const { data, error } = await supabase
    .from('trade_images')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    let rollbackErrMessage: string | null = null;
    try {
      await provider.delete(storagePath);
    } catch (rbErr) {
      rollbackErrMessage = rbErr instanceof Error ? rbErr.message : 'Unknown storage delete error';
    }
    if (rollbackErrMessage) {
      throw new Error(`خطا در ثبت تصویر (${error.message}) و پاکسازی فایل از استوریج نیز ناموفق بود (${rollbackErrMessage})`);
    }
    throw new Error(`خطا در ثبت اطلاعات تصویر در پایگاه داده: ${error.message}`);
  }

  return data;
}

/**
 * Get all images for a trade
 */
export async function getTradeImages(tradeId: string, userId?: string): Promise<TradeImage[]> {
  if (!isSupabaseConfigured || (userId && userId === 'guest-demo-user')) {
    return MockStorage.getTradeImages(tradeId);
  }

  let query = supabase
    .from('trade_images')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: true });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`خطا در دریافت تصاویر معامله: ${error.message}`);
  }

  return data || [];
}

/**
 * Get signed URL for an image
 */
export async function getTradeImageUrl(image: TradeImage): Promise<string> {
  const previewUrl = (image as TradeImage & { preview_url?: string }).preview_url;
  if (previewUrl?.startsWith('data:image/')) return previewUrl;

  const provider = getSupabaseStorageProvider();
  try {
    const url = await provider.getSignedUrl(image.storage_path);
    return url || image.storage_path;
  } catch {
    return image.storage_path;
  }
}

/**
 * Delete a trade image with ownership verification & transactional safety
 */
export async function deleteTradeImage(imageId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    await MockStorage.deleteTradeImage(imageId);
    return;
  }

  // Step 1: Verify image exists and belongs to the user
  const { data: image, error: fetchError } = await supabase
    .from('trade_images')
    .select('*')
    .eq('id', imageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`خطا در بررسی مالکیت تصویر: ${fetchError.message}`);
  }
  if (!image) {
    throw new Error('تصویر مورد نظر یافت نشد یا دسترسی غیرمجاز است');
  }

  const provider = getSupabaseStorageProvider();

  // Step 2: Delete from storage
  await provider.delete(image.storage_path);

  // Step 3: Delete from database
  const { error: dbError } = await supabase
    .from('trade_images')
    .delete()
    .eq('id', imageId)
    .eq('user_id', userId);

  if (dbError) {
    throw new Error(`خطا در حذف رکورد تصویر از پایگاه داده: ${dbError.message}`);
  }
}

/**
 * Replace a trade image safely:
 * - Upload new image
 * - Update metadata
 * - If update fails, delete the new image
 * - Clean old image only after successful DB update
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

  // Step 1: Verify existing image ownership
  const { data: existingImage, error: fetchError } = await supabase
    .from('trade_images')
    .select('*')
    .eq('id', imageId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !existingImage) {
    throw new Error('تصویر قبلی جهت جایگزینی یافت نشد');
  }

  const validation = validateImageFile(newFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const processed = await processImage(newFile);
  const newFilename = `${uuidv4()}.webp`;
  const newStoragePath = `trades/${existingImage.trade_id}/${newFilename}`;

  const provider = getSupabaseStorageProvider();

  // Step 2: Upload new storage object
  await provider.upload({
    path: newStoragePath,
    file: processed.blob,
    contentType: 'image/webp',
  });

  // Step 3: Update metadata in DB
  const { data: updatedRecord, error: updateError } = await supabase
    .from('trade_images')
    .update({
      storage_path: newStoragePath,
      original_filename: newFile.name,
      original_size_bytes: processed.originalSize,
      processed_size_bytes: processed.processedSize,
      mime_type: 'image/webp',
      width: processed.width,
      height: processed.height,
      updated_at: new Date().toISOString(),
    })
    .eq('id', imageId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError) {
    // Rollback newly uploaded image to prevent orphaned storage objects
    let rollbackErrMessage: string | null = null;
    try {
      await provider.delete(newStoragePath);
    } catch (rbErr) {
      rollbackErrMessage = rbErr instanceof Error ? rbErr.message : 'Unknown storage delete error';
    }
    if (rollbackErrMessage) {
      throw new Error(`خطا در به‌روزرسانی اطلاعات تصویر (${updateError.message}) و پاکسازی فایل جدید نیز ناموفق بود (${rollbackErrMessage})`);
    }
    throw new Error(`خطا در به‌روزرسانی اطلاعات تصویر: ${updateError.message}`);
  }

  // Step 4: Clean up old storage object
  try {
    await provider.delete(existingImage.storage_path);
  } catch (cleanErr) {
    console.warn('Warning: Failed to clean up old screenshot:', cleanErr);
  }

  return updatedRecord;
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
    throw new Error(`خطا در دریافت آمار فضای ذخیره‌سازی: ${error.message}`);
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
