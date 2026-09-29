import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { ImportBatch, ImportBatchInsert, ImportBatchUpdate, ImportBatchStatus } from '../types/database';

export async function getImportBatches(userId: string): Promise<ImportBatch[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getImportBatches(userId);
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Falling back to local import batches storage:', error.message);
      return MockStorage.getImportBatches(userId);
    }

    return data || [];
  } catch (err) {
    console.warn('Supabase query failed for import batches, using local storage:', err);
    return MockStorage.getImportBatches(userId);
  }
}

export async function getImportBatch(batchId: string, userId: string): Promise<ImportBatch | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getImportBatch(batchId, userId);
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Falling back to local import batch storage:', error.message);
      return MockStorage.getImportBatch(batchId, userId);
    }

    return data;
  } catch {
    return MockStorage.getImportBatch(batchId, userId);
  }
}

export async function createImportBatch(input: ImportBatchInsert): Promise<ImportBatch> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createImportBatch(input);
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .insert(input)
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert failed, saving import batch locally:', error.message);
      return MockStorage.createImportBatch(input);
    }

    return data;
  } catch {
    return MockStorage.createImportBatch(input);
  }
}

export async function updateImportBatch(
  batchId: string,
  userId: string,
  input: ImportBatchUpdate
): Promise<ImportBatch> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.updateImportBatch(batchId, input);
  }

  try {
    const { data, error } = await supabase
      .from('import_batches')
      .update(input)
      .eq('id', batchId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.warn('Supabase update failed, updating import batch locally:', error.message);
      return MockStorage.updateImportBatch(batchId, input);
    }

    return data;
  } catch {
    return MockStorage.updateImportBatch(batchId, input);
  }
}

export async function completeImportBatch(
  batchId: string,
  userId: string,
  stats: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    duplicate_rows: number;
    imported_rows: number;
    status: ImportBatchStatus;
    error_message?: string;
  }
): Promise<ImportBatch> {
  return updateImportBatch(batchId, userId, {
    ...stats,
    completed_at: new Date().toISOString(),
  });
}
