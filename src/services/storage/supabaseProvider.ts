// ============================================================
// Supabase Storage Provider
// Implementation of StorageProvider using Supabase Storage
// Strictly surfaces real storage errors without silent fake success
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import { STORAGE_CONFIG } from '../../config/storage';
import type { StorageProvider } from './types';

// In-memory map for local guest/demo fallback
const localFileStore = new Map<string, string>();

export class SupabaseStorageProvider implements StorageProvider {
  private bucketName: string;

  constructor(bucketName: string = STORAGE_CONFIG.BUCKET_NAME) {
    this.bucketName = bucketName;
  }

  async upload(params: {
    path: string;
    file: File | Blob;
    contentType: string;
  }): Promise<{ path: string; size: number }> {
    const { path, file, contentType } = params;

    if (!isSupabaseConfigured) {
      const url = URL.createObjectURL(file);
      localFileStore.set(path, url);
      return { path, size: file.size };
    }

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`خطا در آپلود فایل در فضای ابری: ${error.message}`);
    }

    return {
      path: data.path,
      size: file.size,
    };
  }

  async delete(path: string): Promise<void> {
    localFileStore.delete(path);
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) {
      throw new Error(`خطا در حذف تصویر از فضای ابری: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expirySeconds: number = STORAGE_CONFIG.SIGNED_URL_EXPIRY): Promise<string> {
    if (!isSupabaseConfigured || localFileStore.has(path)) {
      return localFileStore.get(path) || '';
    }

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expirySeconds);

    if (error) {
      throw new Error(`خطا در دریافت لینک تصویر: ${error.message}`);
    }

    return data.signedUrl;
  }

  async exists(path: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      return localFileStore.has(path);
    }

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .list(path.split('/').slice(0, -1).join('/'), {
        limit: 1,
        offset: 0,
        search: path.split('/').pop(),
      });

    if (error) {
      throw new Error(`خطا در بررسی وجود تصویر: ${error.message}`);
    }

    return (data || []).length > 0;
  }
}

// Singleton instance
let providerInstance: SupabaseStorageProvider | null = null;

export function getSupabaseStorageProvider(): SupabaseStorageProvider {
  if (!providerInstance) {
    providerInstance = new SupabaseStorageProvider();
  }
  return providerInstance;
}
