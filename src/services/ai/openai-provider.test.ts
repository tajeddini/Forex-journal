import { describe, it, expect } from 'vitest';
import { OpenAICompatibleProvider } from './openai-provider';

describe('OpenAICompatibleProvider Adapter', () => {
  it('initializes for OpenAI with default settings', () => {
    const provider = new OpenAICompatibleProvider('openai', { apiKey: 'sk-test' });
    expect(provider.type).toBe('openai');
    expect(provider.name).toBe('OpenAI');
    expect(provider.isAvailable()).toBe(true);

    const caps = provider.getCapabilities();
    expect(caps.textGeneration).toBe(true);
    expect(caps.structuredOutput).toBe(true);
  });

  it('initializes for Qwen with default settings', () => {
    const provider = new OpenAICompatibleProvider('qwen', { apiKey: 'qwen-test' });
    expect(provider.type).toBe('qwen');
    expect(provider.name).toBe('Qwen / DashScope');
    expect(provider.isAvailable()).toBe(true);
  });

  it('returns unavailable when no apiKey is supplied', () => {
    const provider = new OpenAICompatibleProvider('openai', { apiKey: '' });
    expect(provider.isAvailable()).toBe(false);
  });

  it('throws API_KEY_MISSING on execution without valid apiKey', async () => {
    const provider = new OpenAICompatibleProvider('openai', { apiKey: '' });
    await expect(provider.generateText('hello')).rejects.toThrowError(
      expect.objectContaining({
        code: 'API_KEY_MISSING',
      })
    );
  });
});
