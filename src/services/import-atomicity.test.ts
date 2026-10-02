import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createImportBatch, completeImportBatch, rollbackAndFailImportBatch, getImportBatch } from './importBatches';
import { deleteTradesByBatchId, createTradesBatch } from './trades';
import { MockStorage } from './mockStorage';
import { findDuplicates } from '../utils/duplicate-detector';
import type { TradeInsert } from '../types/database';
import type { NormalizedTrade } from '../utils/trade-normalizer';

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

  it('6. rollback failure is detected and surfaces as critical error instead of being swallowed', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'fail_rollback.csv',
      file_size: 500,
      total_rows: 2,
      valid_rows: 2,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    // Mock deletion failure
    const deleteSpy = vi.spyOn(MockStorage, 'deleteTradesByBatchId').mockRejectedValueOnce(
      new Error('Disk I/O failure during rollback deletion')
    );

    await expect(
      rollbackAndFailImportBatch(batch.id, userId, 'Chunk import failed')
    ).rejects.toThrow(/خطای بحرانی.*Disk I\/O failure/);

    deleteSpy.mockRestore();
  });

  it('7. importing same file twice detects existing trades and prevents duplicates (idempotency)', async () => {
    // Initial import of 2 trades
    const initialTrades: TradeInsert[] = [
      {
        user_id: userId,
        account_id: accountId,
        ticket: 'MT4_1001',
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        entry_datetime: '2024-01-10T10:00:00Z',
        entry_price: 1.1000,
        exit_datetime: '2024-01-10T11:00:00Z',
        exit_price: 1.1050,
        profit: 50,
        source: 'mt4',
      },
      {
        user_id: userId,
        account_id: accountId,
        ticket: 'MT4_1002',
        symbol: 'GBPUSD',
        side: 'sell',
        volume: 0.2,
        entry_datetime: '2024-01-10T12:00:00Z',
        entry_price: 1.2500,
        exit_datetime: '2024-01-10T13:00:00Z',
        exit_price: 1.2450,
        profit: 100,
        source: 'mt4',
      },
    ];

    for (const t of initialTrades) {
      await MockStorage.createTrade(t);
    }

    const existingTrades = await MockStorage.getTrades({ accountId });

    // Second import with same records plus 1 new trade
    const candidateTrades: NormalizedTrade[] = [
      {
        ticket: 'MT4_1001',
        position_id: null,
        symbol: 'EURUSD',
        side: 'buy',
        volume: 0.1,
        entry_datetime: '2024-01-10T10:00:00Z',
        entry_price: 1.1000,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-10T11:00:00Z',
        exit_price: 1.1050,
        commission: 0,
        swap: 0,
        profit: 50,
        comment: null,
        magic_number: null,
      },
      {
        ticket: 'MT4_1002',
        position_id: null,
        symbol: 'GBPUSD',
        side: 'sell',
        volume: 0.2,
        entry_datetime: '2024-01-10T12:00:00Z',
        entry_price: 1.2500,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-10T13:00:00Z',
        exit_price: 1.2450,
        commission: 0,
        swap: 0,
        profit: 100,
        comment: null,
        magic_number: null,
      },
      {
        ticket: 'MT4_1003',
        position_id: null,
        symbol: 'USDJPY',
        side: 'buy',
        volume: 0.5,
        entry_datetime: '2024-01-10T14:00:00Z',
        entry_price: 145.0,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-10T15:00:00Z',
        exit_price: 145.5,
        commission: 0,
        swap: 0,
        profit: 250,
        comment: null,
        magic_number: null,
      },
    ];

    const duplicates = findDuplicates(candidateTrades, existingTrades);
    expect(duplicates.size).toBe(2);
    expect(duplicates.has(0)).toBe(true); // MT4_1001 duplicate
    expect(duplicates.has(1)).toBe(true); // MT4_1002 duplicate
    expect(duplicates.has(2)).toBe(false); // MT4_1003 new trade

    // Only non-duplicate trades are imported
    const toImport = candidateTrades.filter((_, idx) => !duplicates.has(idx));
    expect(toImport.length).toBe(1);
    expect(toImport[0].ticket).toBe('MT4_1003');
  });

  it('8. protects against duplicate MT5 records using position_id identifier', async () => {
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      position_id: 'MT5_POS_7777',
      symbol: 'XAUUSD',
      side: 'buy',
      volume: 1.0,
      entry_datetime: '2024-01-05T08:00:00Z',
      entry_price: 2050,
      exit_datetime: '2024-01-05T12:00:00Z',
      exit_price: 2060,
      profit: 1000,
      source: 'mt5',
    });

    const existing = await MockStorage.getTrades({ accountId });

    const incomingMT5: NormalizedTrade[] = [
      {
        ticket: null,
        position_id: 'MT5_POS_7777', // Same position_id
        symbol: 'XAUUSD',
        side: 'buy',
        volume: 1.0,
        entry_datetime: '2024-01-05T08:00:00Z',
        entry_price: 2050,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-05T12:00:00Z',
        exit_price: 2060,
        commission: -10,
        swap: 0,
        profit: 1000,
        comment: null,
        magic_number: null,
      },
    ];

    const dupes = findDuplicates(incomingMT5, existing);
    expect(dupes.size).toBe(1);
    expect(dupes.has(0)).toBe(true);
  });

  it('9. protects against duplicate MT4 records using ticket identifier', async () => {
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      ticket: 'TICKET_8888',
      symbol: 'EURUSD',
      side: 'sell',
      volume: 0.5,
      entry_datetime: '2024-01-08T09:00:00Z',
      entry_price: 1.0950,
      exit_datetime: '2024-01-08T10:00:00Z',
      exit_price: 1.0920,
      profit: 150,
      source: 'mt4',
    });

    const existing = await MockStorage.getTrades({ accountId });

    const incomingMT4: NormalizedTrade[] = [
      {
        ticket: 'TICKET_8888',
        position_id: null,
        symbol: 'EURUSD',
        side: 'sell',
        volume: 0.5,
        entry_datetime: '2024-01-08T09:00:00Z',
        entry_price: 1.0950,
        stop_loss: null,
        take_profit: null,
        exit_datetime: '2024-01-08T10:00:00Z',
        exit_price: 1.0920,
        commission: 0,
        swap: 0,
        profit: 150,
        comment: null,
        magic_number: null,
      },
    ];

    const dupes = findDuplicates(incomingMT4, existing);
    expect(dupes.size).toBe(1);
    expect(dupes.has(0)).toBe(true);
  });

  it('10. handles network/database failure during persistence and triggers complete rollback', async () => {
    const batch = await createImportBatch({
      user_id: userId,
      account_id: accountId,
      source: 'mt4',
      file_name: 'network_fail.csv',
      file_size: 1024,
      total_rows: 4,
      valid_rows: 4,
      invalid_rows: 0,
      duplicate_rows: 0,
      imported_rows: 0,
      status: 'processing',
    });

    // Chunk 1 persists
    await MockStorage.createTrade({
      user_id: userId,
      account_id: accountId,
      import_batch_id: batch.id,
      ticket: 'NET_1',
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

    // Simulating chunk 2 encountering database connection drop
    const networkError = new Error('Connection terminated unexpectedly: 504 Gateway Timeout');
    let rollbackSuccess = false;

    try {
      throw networkError;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      await rollbackAndFailImportBatch(batch.id, userId, errMessage);
      rollbackSuccess = true;
    }

    expect(rollbackSuccess).toBe(true);

    // Verify batch is marked failed and no trades remain
    const batchRecord = await getImportBatch(batch.id, userId);
    expect(batchRecord?.status).toBe('failed');
    expect(batchRecord?.error_message).toContain('504 Gateway Timeout');

    const storedTrades = await MockStorage.getTrades({ accountId });
    expect(storedTrades.filter(t => t.import_batch_id === batch.id).length).toBe(0);
  });

  it('11. deletes trades by batch id cleanly', async () => {
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
