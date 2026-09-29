import { supabase } from './supabase';
import type { ImportBatch, ImportBatchInsert, ImportBatchUpdate, ImportBatchStatus } from '../types/database';

export async function getImportBatches(userId: string): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching import batches:', error);
    throw new Error('خطا در دریافت تاریخچه ورود');
  }

  return data || [];
}

export async function getImportBatch(batchId: string, userId: string): Promise<ImportBatch | null> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .eq('id', batchId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching import batch:', error);
    throw new Error('خطا در دریافت batch');
  }

  return data;
}

export async function createImportBatch(input: ImportBatchInsert): Promise<ImportBatch> {
  const { data, error } = await supabase
    .from('import_batches')
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error('Error creating import batch:', error);
    throw new Error('خطا در ایجاد batch');
  }

  return data;
}

export async function updateImportBatch(
  batchId: string,
  userId: string,
  input: ImportBatchUpdate
): Promise<ImportBatch> {
  const { data, error } = await supabase
    .from('import_batches')
    .update(input)
    .eq('id', batchId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating import batch:', error);
    throw new Error('خطا در بروزرسانی batch');
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
