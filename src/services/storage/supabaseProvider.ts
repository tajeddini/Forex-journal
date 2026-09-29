// ============================================================
// Supabase Storage Provider
// Implementation of StorageProvider using Supabase Storage
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabase';
import { STORAGE_CONFIG } from '../../config/storage';
import type { StorageProvider } from './types';

// In-memory/localStorage map for local fallback
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
      // Local fallback: create object URL
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
      console.error('Supabase Storage upload error:', error);
      const url = URL.createObjectURL(file);
      localFileStore.set(path, url);
      return { path, size: file.size };
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
      console.error('Supabase Storage delete error:', error);
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
      return localFileStore.get(path) || '';
    }

    return data.signedUrl;
  }

  async exists(path: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      return localFileStore.has(path);
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(path.split('/').slice(0, -1).join('/'), {
          limit: 1,
          offset: 0,
          search: path.split('/').pop(),
        });

      if (error) {
        return localFileStore.has(path);
      }

      return data.length > 0;
    } catch {
      return localFileStore.has(path);
    }
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
