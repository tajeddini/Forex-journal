import { describe, it, expect, beforeEach } from 'vitest';
import { createImportBatch, completeImportBatch, rollbackAndFailImportBatch, getImportBatch } from './importBatches';
import { deleteTradesByBatchId } from './trades';
import { MockStorage } from './mockStorage';
import type { TradeInsert } from '../types/database';

describe('Import Atomicity, Rollback & Idempotency', () => {
  const userId = 'guest-demo-user';
  const accountId = 'mock-account-1';

  beforeEach(() => {
    // Clear storage if available
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. performs successful multi-chunk import and completes batch', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'test_multi.csv',
      file_size: 1024,
      total_rows: 6,
      valid_rows: 6,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    const trades: TradeInsert[] = Array.from({ length: 6 }).map((_, i) => ({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: `2024-01-01T10:0${i}:00Z`,
      entry_price: 1.1000 + i * 0.001,
      exit_datetime: `2024-01-01T11:0${i}:00Z`,
      exit_price: 1.1050 + i * 0.001,
      profit: 50,
      source: 'mt4',
    }));

    // Chunk size 2 => 3 chunks
    const chunkSize = 2;
    for (let i = 0; i < trades.length; i += chunkSize) {
      const chunk = trades.slice(i, i + chunkSize);
      for (const t of chunk) {
        await MockStorage.createTrade(t);
      }
    }

    const completed = await completeImportBatch(batch.id, userId, {
      total_rows: 6,
      valid_rows: 6,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 6,
      status: 'completed',
    });

    expect(completed.status).toBe('completed');
    expect(completed.imported_rows).toBe(6);

    const storedTrades = await MockStorage.getTrades({ accountId });
    const batchTrades = storedTrades.filter(t => t.import_batch_id === batch.id);
    expect(batchTrades.length).toBe(6);
  });

  it('2. rolls back immediately when failure occurs in the first chunk', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'fail_chunk1.csv',
      file_size: 512,
      total_rows: 4,
      valid_rows: 4,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    // Chunk 1 fails immediately
    const errorMsg = 'Database network failure on chunk 1';
    await rollbackAndFailImportBatch(batch.id, userId, errorMsg);

    const batchRecord = await getImportBatch(batch.id, userId);
    expect(batchRecord?.status).toBe('failed');
    expect(batchRecord?.error_message).toBe(errorMsg);
    expect(batchRecord?.imported_rows).toBe(0);

    const storedTrades = await MockStorage.getTrades({ accountId });
    expect(storedTrades.filter(t => t.import_batch_id === batch.id).length).toBe(0);
  });

  it('3. rolls back all previously inserted chunks when failure occurs in a middle chunk', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'fail_chunk2.csv',
      file_size: 1024,
      total_rows: 6,
      valid_rows: 6,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    // Chunk 1 succeeds: insert 2 trades
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-01T10:00:00Z',
      exit_datetime: '2024-01-01T11:00:00Z',
      entry_price: 1.1,
      exit_price: 1.11,
      profit: 100,
      source: 'mt4',
    });
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch.id,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-01T10:05:00Z',
      exit_datetime: '2024-01-01T11:05:00Z',
      entry_price: 1.1,
      exit_price: 1.11,
      profit: 100,
      source: 'mt4',
    });

    // Chunk 2 throws an error
    const errorMsg = 'Foreign key constraint violated on row 3';
    await rollbackAndFailImportBatch(batch.id, userId, errorMsg);

    // Verify 0 partial trades remain for this batch
    const storedTrades = await MockStorage.getTrades({ accountId });
    const remainingForBatch = storedTrades.filter(t => t.import_batch_id === batch.id);
    expect(remainingForBatch.length).toBe(0);

    const batchRecord = await getImportBatch(batch.id, userId);
    expect(batchRecord?.status).toBe('failed');
    expect(batchRecord?.imported_rows).toBe(0);
  });

  it('4. rolls back all inserted chunks when failure occurs in the final chunk', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'fail_final_chunk.csv',
      file_size: 1024,
      total_rows: 4,
      valid_rows: 4,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    // Insert 3 trades from previous chunks
    for (let i = 0; i < 3; i++) {
      await MockStorage.createTrade({
        user_id: userId,
        account_id: accountId,
        import_batch_id: batch.id,
        symbol: 'GBPUSD',
        side: 'buy',
        volume: 1.0,
        entry_datetime: `2024-01-01T12:0${i}:00Z`,
        exit_datetime: `2024-01-01T13:0${i}:00Z`,
        entry_price: 1.25,
        exit_price: 1.26,
        profit: 100,
        source: 'mt4',
      });
    }

    // Final chunk fails
    await rollbackAndFailImportBatch(batch.id, userId, 'Storage write quota exceeded in final chunk');

    const storedTrades = await MockStorage.getTrades({ accountId });
    expect(storedTrades.filter(t => t.import_batch_id === batch.id).length).toBe(0);
  });

  it('5. allows clean retry after failure without duplicate collisions or partial records', async () => {
    // 1st attempt: fails
    const batch1 = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'trades_retry.csv',
      file_size: 100,
      total_rows: 2,
      valid_rows: 2,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch1.id,
      ticket: 'TICKET_9999',
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-01T10:00:00Z',
      exit_datetime: '2024-01-01T11:00:00Z',
      entry_price: 1.1,
      exit_price: 1.11,
      profit: 100,
      source: 'mt4',
    });

    // Rollback
    await rollbackAndFailImportBatch(batch1.id, userId, 'Transient error');

    // 2nd attempt: Retry with new batch
    const batch2 = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'trades_retry.csv',
      file_size: 100,
      total_rows: 2,
      valid_rows: 2,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch2.id,
      ticket: 'TICKET_9999',
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-01T10:00:00Z',
      exit_datetime: '2024-01-01T11:00:00Z',
      entry_price: 1.1,
      exit_price: 1.11,
      profit: 100,
      source: 'mt4',
    });

    const completed = await completeImportBatch(batch2.id, userId, {
      total_rows: 1,
      valid_rows: 1,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 1,
      status: 'completed',
    });

    expect(completed.status).toBe('completed');
    const stored = await MockStorage.getTrades({ accountId });
    const forTicket = stored.filter(t => t.ticket === 'TICKET_9999');
    // Exactly 1 trade exists, not duplicated!
    expect(forTicket.length).toBe(1);
    expect(forTicket[0].import_batch_id).toBe(batch2.id);
  });

  it('6. deletes trades by batch id cleanly', async () => {
    const testBatchId = 'batch-cleanup-test';
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: testBatchId,
      symbol: 'EURUSD',
      side: 'buy',
      volume: 1,
      entry_datetime: '2024-01-01T00:00:00Z',
      exit_datetime: '2024-01-01T01:00:00Z',
      entry_price: 1.1,
      exit_price: 1.11,
      profit: 10,
      source: 'mt4',
    });

    const deleted = await deleteTradesByBatchId(testBatchId, userId);
    expect(deleted).toBeGreaterThanOrEqual(1);

    const trades = await MockStorage.getTrades({ accountId });
    expect(trades.some(t => t.import_batch_id === testBatchId)).toBe(false);
  });
});
