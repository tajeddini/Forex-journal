import { describe, it, expect, beforeEach } from 'vitest';
import { AIProviderRegistry } from './provider-registry';
import { AIError, type AIProvider } from './types';

describe('AIProviderRegistry — Silent Mock Fallback Elimination', () => {
  it('allows mock provider by default in development/test environment', () => {
    const registry = new AIProviderRegistry({ isProduction: false });
    const provider = registry.getCurrentProvider();

    expect(provider).toBeDefined();
    expect(provider.type).toBe('mock');
    expect(registry.getProviderState().status).toBe('mock');
    expect(registry.hasRealProvider()).toBe(false);
    expect(registry.getProviderState().isMock).toBe(true);
  });

  it('throws AI_PROVIDER_NOT_CONFIGURED in production when no real provider is set', () => {
    const registry = new AIProviderRegistry({ isProduction: true, allowMockInProduction: false });

    expect(registry.getProviderState().status).toBe('not_configured');
    expect(registry.hasRealProvider()).toBe(false);

    expect(() => registry.getCurrentProvider()).toThrowError(
      expect.objectContaining({
        code: 'AI_PROVIDER_NOT_CONFIGURED',
      })
    );
  });

  it('rejects silent fallback to mock in production when setting mock provider', () => {
    const registry = new AIProviderRegistry({ isProduction: true, allowMockInProduction: false });

    expect(() => {
      registry.setProvider({ type: 'mock' });
    }).toThrowError(
      expect.objectContaining({
        code: 'PROVIDER_CONFIG_ERROR',
      })
    );
  });

  it('throws PROVIDER_CONFIG_ERROR when configuring an unregistered provider', () => {
    const registry = new AIProviderRegistry({ isProduction: true });

    expect(() => {
      registry.setProvider({ type: 'qwen' });
    }).toThrowError(
      expect.objectContaining({
        code: 'PROVIDER_CONFIG_ERROR',
      })
    );
  });

  it('throws PROVIDER_UNAVAILABLE when registered provider is not available', () => {
    const registry = new AIProviderRegistry({ isProduction: true });

    const unavailableProvider: AIProvider = {
      name: 'Test Qwen Provider',
      type: 'qwen',
      isAvailable: () => false,
      generateText: async () => ({ data: '' }),
      generateStructured: async () => ({ data: {} }),
      getCapabilities: () => ({
        textGeneration: true,
        structuredOutput: true,
        streaming: false,
        vision: false,
        functionCalling: false,
      }),
    };

    registry.registerProvider(unavailableProvider);

    expect(() => {
      registry.setProvider({ type: 'qwen' });
    }).toThrowError(
      expect.objectContaining({
        code: 'PROVIDER_UNAVAILABLE',
      })
    );
  });

  it('properly activates a real available provider in production', () => {
    const registry = new AIProviderRegistry({ isProduction: true });

    const realProvider: AIProvider = {
      name: 'Production Gemini Provider',
      type: 'gemini',
      isAvailable: () => true,
      generateText: async () => ({ data: 'Real analysis', isMock: false, providerType: 'gemini' }),
      generateStructured: async () => ({ data: {}, isMock: false, providerType: 'gemini' }),
      getCapabilities: () => ({
        textGeneration: true,
        structuredOutput: true,
        streaming: true,
        vision: false,
        functionCalling: true,
      }),
    };

    registry.registerProvider(realProvider);
    registry.setProvider({ type: 'gemini', apiKey: 'valid-key' });

    expect(registry.hasRealProvider()).toBe(true);
    expect(registry.getCurrentProvider().name).toBe('Production Gemini Provider');
    const state = registry.getProviderState();
    expect(state.status).toBe('ready');
    expect(state.providerType).toBe('gemini');
    expect(state.isMock).toBe(false);
  });
});
