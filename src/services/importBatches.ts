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
 * Rollback an import batch completely: delete any inserted trades, verify cleanup, and mark batch as failed
 */
export async function rollbackAndFailImportBatch(
  batchId: string,
  userId: string,
  error_message: string
): Promise<ImportBatch> {
  let cleanupError: string | null = null;

  if (!isSupabaseConfigured || userId === 'guest-demo-user') {
    try {
      await MockStorage.deleteTradesByBatchId(batchId);
    } catch (err) {
      cleanupError = err instanceof Error ? err.message : 'MockStorage deletion failed';
    }
  } else {
    // Delete all trades linked to this batch
    const { error: deleteError } = await supabase
      .from('trades')
      .delete()
      .eq('import_batch_id', batchId)
      .eq('user_id', userId);

    if (deleteError) {
      cleanupError = deleteError.message;
    } else {
      // Verify zero orphaned trades remain
      const { data: remainingTrades, error: checkError } = await supabase
        .from('trades')
        .select('id')
        .eq('import_batch_id', batchId)
        .eq('user_id', userId);

      if (checkError) {
        cleanupError = `بررسی وضعیت پاکسازی معاملات با شکست مواجه شد: ${checkError.message}`;
      } else if (remainingTrades && remainingTrades.length > 0) {
        cleanupError = `پاکسازی ناقص: ${remainingTrades.length} معامله از این دسته حذف نشد`;
      }
    }
  }

  const finalErrorMessage = cleanupError
    ? `${error_message} | [خطای بحرانی در پاکسازی رکوردهای ناقص]: ${cleanupError}`
    : error_message;

  const updatedBatch = await failImportBatch(batchId, userId, finalErrorMessage, 0);

  if (cleanupError) {
    throw new Error(`خطای بحرانی: ورود اطلاعات شکست خورد (${error_message}) و پاکسازی معاملات ناقص نیز ناموفق بود: ${cleanupError}`);
  }

  return updatedBatch;
}
