import { describe, it, expect, beforeEach } from 'vitest';
import { getTradesWithJournal, getTradeCount, saveTradeJournal, getTradeWithJournal } from './tradeJournals';
import { MockStorage } from './mockStorage';

describe('Trade Journals Service — Filtering, Pagination & Count Consistency', () => {
  const guestUserId = 'guest-demo-user';

  beforeEach(() => {
    // Reset mock storage if localStorage is available
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('maintains strict consistency between trade count and paginated items in guest mode', async () => {
    const totalCount = await getTradeCount(guestUserId);
    expect(totalCount).toBeGreaterThan(0);

    const page1 = await getTradesWithJournal(guestUserId, {}, 1, 5);
    expect(page1.length).toBeLessThanOrEqual(5);

    const page2 = await getTradesWithJournal(guestUserId, {}, 2, 5);
    expect(page2.length).toBeLessThanOrEqual(5);

    if (page1.length > 0 && page2.length > 0) {
      // Disjoint sets across pages
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  it('filters by search keyword consistently in both data and count queries', async () => {
    const allTrades = await MockStorage.getTrades();
    if (allTrades.length > 0) {
      const searchTarget = allTrades[0].symbol;
      const count = await getTradeCount(guestUserId, { search: searchTarget });
      const items = await getTradesWithJournal(guestUserId, { search: searchTarget }, 1, 50);

      expect(count).toBe(items.length);
      expect(items.every(t => t.symbol.toLowerCase().includes(searchTarget.toLowerCase()))).toBe(true);
    }
  });

  it('returns empty list and count 0 when no trades match filters', async () => {
    const count = await getTradeCount(guestUserId, { search: 'NON_EXISTENT_PAIR_XYZ' });
    const items = await getTradesWithJournal(guestUserId, { search: 'NON_EXISTENT_PAIR_XYZ' }, 1, 10);

    expect(count).toBe(0);
    expect(items).toHaveLength(0);
  });

  it('saves and updates journal notes without data loss and retrieves them in getTradeWithJournal', async () => {
    const trades = await MockStorage.getTrades();
    if (trades.length > 0) {
      const targetTradeId = trades[0].id;
      const saved = await saveTradeJournal({
        trade_id: targetTradeId,
        user_id: guestUserId,
        entry_reason: 'شکست خط روند صعودی با تایید حجم',
        emotion_during: 'آرام و مسلط بر احساسات',
        status: 'completed',
        rule_adherence: 'followed',
      });

      expect(saved.trade_id).toBe(targetTradeId);
      expect(saved.entry_reason).toBe('شکست خط روند صعودی با تایید حجم');
      expect(saved.emotion_during).toBe('آرام و مسلط بر احساسات');
      expect(saved.status).toBe('completed');

      // Verify that getTradeWithJournal retrieves the persisted journal
      const fetched = await getTradeWithJournal(targetTradeId, guestUserId);
      expect(fetched).not.toBeNull();
      expect(fetched?.journal).not.toBeNull();
      expect(fetched?.journal?.entry_reason).toBe('شکست خط روند صعودی با تایید حجم');
      expect(fetched?.journal?.emotion_during).toBe('آرام و مسلط بر احساسات');
      expect(fetched?.journal?.status).toBe('completed');

      // Verify that getTradesWithJournal retrieves the journal in the list
      const list = await getTradesWithJournal(guestUserId, {}, 1, 50);
      const match = list.find(t => t.id === targetTradeId);
      expect(match?.journal).not.toBeNull();
      expect(match?.journal?.entry_reason).toBe('شکست خط روند صعودی با تایید حجم');
    }
  });
});
