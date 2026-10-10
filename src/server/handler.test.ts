import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeServerPatternInsights } = vi.hoisted(() => ({
  executeServerPatternInsights: vi.fn(),
}));

vi.mock('../services/ai/server-orchestrator', () => ({
  executeServerAIQuery: vi.fn(),
  executeServerTradeReview: vi.fn(),
  executeServerAutoTagging: vi.fn(),
  executeServerPeriodicReview: vi.fn(),
  executeServerPatternInsights,
}));

import { handleAIQueryRequest } from './handler';

describe('AI query handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeServerPatternInsights.mockResolvedValue({ insights: [] });
  });

  it('forwards the selected dateRange to server-side pattern insights', async () => {
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer test-token' },
      body: {
        action: 'pattern-insights',
        dateRange: '90d',
        accountId: 'account-1',
        phaseId: 'phase-1',
      },
    };
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handleAIQueryRequest(req, res);

    expect(executeServerPatternInsights).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        dateRange: '90d',
        accountId: 'account-1',
        phaseId: 'phase-1',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
