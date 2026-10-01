import { supabase, isSupabaseConfigured } from './supabase';
import { MockStorage } from './mockStorage';
import type { ImportBatch, ImportBatchInsert, ImportBatchUpdate, ImportBatchStatus } from '../types/database';

export async function getImportBatches(userId: string): Promise<ImportBatch[]> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getImportBatches(userId);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`خطا در دریافت دسته‌های ورود اطلاعات: ${error.message}`);
  }

  return data || [];
}

export async function getImportBatch(batchId: string, userId: string): Promise<ImportBatch | null> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.getImportBatch(batchId, userId);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`خطا در دریافت دسته ورود: ${error.message}`);
  }

  return data;
}

export async function createImportBatch(input: ImportBatchInsert): Promise<ImportBatch> {
  if (!isSupabaseConfigured || input.user_id === 'guest-demo-user') {
    return MockStorage.createImportBatch(input);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در ایجاد دسته ورود اطلاعات: ${error.message}`);
  }

  return data;
}

export async function updateImportBatch(
  batchId: string,
  userId: string,
  input: ImportBatchUpdate
): Promise<ImportBatch> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    return MockStorage.updateImportBatch(batchId, input);
  }

  const { data, error } = await supabase
    .from('import_batches')
    .update(input)
    .eq('id', batchId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`خطا در به‌روزرسانی دسته ورود: ${error.message}`);
  }

  return data;
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

export async function failImportBatch(
  batchId: string,
  userId: string,
  error_message: string,
  imported_rows: number = 0
): Promise<ImportBatch> {
  return updateImportBatch(batchId, userId, {
    status: 'failed',
    error_message,
    imported_rows,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Rollback an import batch completely: delete any inserted trades and mark batch as failed
 */
export async function rollbackAndFailImportBatch(
  batchId: string,
  userId: string,
  error_message: string
): Promise<ImportBatch> {
  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    await MockStorage.deleteTradesByBatchId(batchId);
    return failImportBatch(batchId, userId, error_message, 0);
  }

  // Delete all trades linked to this batch
  await supabase
    .from('trades')
    .delete()
    .eq('import_batch_id', batchId)
    .eq('user_id', userId);

  return failImportBatch(batchId, userId, error_message, 0);
}
