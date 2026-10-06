import { describe, it, expect } from 'vitest';
import { GeminiAIProvider } from './gemini-provider';

describe('GeminiAIProvider Adapter', () => {
  it('reports correct capabilities', () => {
    const provider = new GeminiAIProvider({ apiKey: 'test-key' });
    const caps = provider.getCapabilities();

    expect(caps.textGeneration).toBe(true);
    expect(caps.structuredOutput).toBe(true);
    expect(caps.streaming).toBe(true);
    expect(caps.vision).toBe(false); // Vision explicitly disabled for phase 13 security
    expect(caps.functionCalling).toBe(true);
  });

  it('reports unavailable when no API key is provided', () => {
    const provider = new GeminiAIProvider({ apiKey: '' });
    expect(provider.isAvailable()).toBe(false);
  });

  it('throws API_KEY_MISSING on execution without valid client/key', async () => {
    const provider = new GeminiAIProvider({ apiKey: '' });
    await expect(provider.generateText('hello')).rejects.toThrowError(
      expect.objectContaining({
        code: 'API_KEY_MISSING',
      })
    );
  });
});
