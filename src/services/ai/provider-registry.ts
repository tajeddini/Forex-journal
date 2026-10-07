// ============================================================
// AI Provider Registry
// Manages AI provider instances and selection with explicit
// separation between Development/Test (Mock allowed) and
// Production (explicit error, no silent mock fallback).
// ============================================================

import type { AIProvider, AIProviderConfig, AIProviderType, AIProviderState } from './types';
import { AIError } from './types';
import { getMockAIProvider } from './mock-provider';
import { GeminiAIProvider } from './gemini-provider';
import { OpenAICompatibleProvider } from './openai-provider';
import { ClaudeAIProvider } from './claude-provider';

export function createAIProviderInstance(config: AIProviderConfig): AIProvider {
  if (config.type === 'gemini') {
    return new GeminiAIProvider({ apiKey: config.apiKey, model: config.model });
  }
  if (config.type === 'openai') {
    return new OpenAICompatibleProvider('openai', { apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
  }
  if (config.type === 'qwen') {
    return new OpenAICompatibleProvider('qwen', { apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
  }
  if (config.type === 'claude') {
    return new ClaudeAIProvider({ apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
  }
  if (config.type === 'custom') {
    if (!config.baseUrl?.trim()) throw new AIError('برای پرووایدر سفارشی، Base URL الزامی است.', 'PROVIDER_CONFIG_ERROR', 'custom');
    return new OpenAICompatibleProvider('custom', { apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl });
  }
  if (config.type === 'mock') {
    return getMockAIProvider();
  }
  throw new AIError(`پرووایدر هوش مصنوعی '${config.type}' پشتیبانی نمی‌شود`, 'PROVIDER_CONFIG_ERROR', config.type);
}

export function isProductionEnvironment(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test') {
    return false;
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD === true) {
    return true;
  }
  return false;
}

export class AIProviderRegistry {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private currentProvider: AIProvider | null = null;
  private currentConfig: AIProviderConfig | null = null;
  private isProduction: boolean = false;
  private allowMockInProduction: boolean = false;

  constructor(options?: {
    isProduction?: boolean;
    allowMockInProduction?: boolean;
    defaultProvider?: AIProviderType;
  }) {
    this.isProduction = options?.isProduction ?? isProductionEnvironment();
    this.allowMockInProduction = options?.allowMockInProduction ?? false;

    // Register mock provider in registry
    const mock = getMockAIProvider();
    this.registerProvider(mock);

    // Register real Gemini provider
    const gemini = new GeminiAIProvider();
    this.registerProvider(gemini);

    // Check server environment configuration
    const envProvider = options?.defaultProvider ?? (typeof process !== 'undefined' ? process.env?.AI_PROVIDER : undefined);

    if (envProvider === 'gemini') {
      if (gemini.isAvailable()) {
        this.currentProvider = gemini;
        this.currentConfig = { type: 'gemini', model: gemini.type };
      } else {
        this.currentProvider = null;
        this.currentConfig = null;
      }
    } else if (envProvider === 'mock') {
      if (this.isProduction && !this.allowMockInProduction) {
        this.currentProvider = null;
        this.currentConfig = null;
      } else {
        this.currentProvider = mock;
        this.currentConfig = { type: 'mock' };
      }
    } else if (!this.isProduction || this.allowMockInProduction) {
      this.currentProvider = mock;
      this.currentConfig = { type: 'mock' };
    } else {
      // In production without configured key: NO silent mock fallback
      this.currentProvider = null;
      this.currentConfig = null;
    }
  }

  /**
   * Register a new AI provider
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.type, provider);
  }

  /**
   * Get a registered provider by type
   */
  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get the current active provider.
   * In Production: Throws AI_PROVIDER_NOT_CONFIGURED instead of silently falling back to mock.
   */
  getCurrentProvider(): AIProvider {
    if (!this.currentProvider) {
      if (this.isProduction && !this.allowMockInProduction) {
        throw new AIError(
          'پرووایدر هوش مصنوعی برای محیط عملیاتی پیکربندی نشده است (AI_PROVIDER_NOT_CONFIGURED)',
          'AI_PROVIDER_NOT_CONFIGURED'
        );
      }
      return getMockAIProvider();
    }

    if (this.isProduction && this.currentProvider.type === 'mock' && !this.allowMockInProduction) {
      throw new AIError(
        'پرووایدر شبیه‌ساز (Mock) در محیط عملیاتی بدون پیکربندی پرووایدر واقعی مجاز نیست (AI_PROVIDER_NOT_CONFIGURED)',
        'AI_PROVIDER_NOT_CONFIGURED',
        'mock'
      );
    }

    return this.currentProvider;
  }

  /**
   * Set the active provider by configuration.
   * Throws explicit typed errors on configuration or availability issues.
   * Does NOT silently fall back to mock.
   */
  setProvider(config: AIProviderConfig): void {
    if (config.type === 'mock') {
      if (this.isProduction && !this.allowMockInProduction) {
        throw new AIError(
          'استفاده از شبیه‌ساز Mock در محیط پروداکشن بدون مجوز مجاز نیست',
          'PROVIDER_CONFIG_ERROR',
          'mock'
        );
      }
      this.currentProvider = getMockAIProvider();
      this.currentConfig = config;
      return;
    }

    const provider = this.providers.get(config.type);
    if (!provider) {
      throw new AIError(
        `پرووایدر هوش مصنوعی '${config.type}' ثبت نشده است`,
        'PROVIDER_CONFIG_ERROR',
        config.type
      );
    }

    // Check availability
    if (!provider.isAvailable()) {
      throw new AIError(
        `پرووایدر هوش مصنوعی '${config.type}' در دسترس نیست یا کلید API آن نامعتبر است`,
        'PROVIDER_UNAVAILABLE',
        config.type
      );
    }

    this.currentProvider = provider;
    this.currentConfig = config;
  }

  /**
   * Get current provider configuration
   */
  getCurrentConfig(): AIProviderConfig | null {
    return this.currentConfig;
  }

  /**
   * Explicit detailed state of the AI provider system
   */
  getProviderState(): AIProviderState {
    if (!this.currentProvider) {
      return {
        status: 'not_configured',
        providerType: null,
        isMock: false,
        message: 'پرووایدر هوش مصنوعی پیکربندی نشده است',
      };
    }

    if (this.currentProvider.type === 'mock') {
      return {
        status: 'mock',
        providerType: 'mock',
        isMock: true,
        message: 'پرووایدر شبیه‌ساز (Mock) فعال است',
      };
    }

    if (!this.currentProvider.isAvailable()) {
      return {
        status: 'unavailable',
        providerType: this.currentProvider.type,
        isMock: false,
        message: 'پرووایدر انتخاب شده در دسترس نیست',
      };
    }

    return {
      status: 'ready',
      providerType: this.currentProvider.type,
      isMock: false,
    };
  }

  /**
   * Check if a real (non-mock) provider is configured and available
   */
  hasRealProvider(): boolean {
    return (
      this.currentProvider !== null &&
      this.currentProvider.type !== 'mock' &&
      this.currentProvider.isAvailable()
    );
  }

  /**
   * Get all registered provider types
   */
  getRegisteredProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Reset provider to default state
   */
  resetToMock(): void {
    if (this.isProduction && !this.allowMockInProduction) {
      this.currentProvider = null;
      this.currentConfig = null;
    } else {
      this.currentProvider = getMockAIProvider();
      this.currentConfig = { type: 'mock' };
    }
  }

  /**
   * Override mock permission in production (for controlled tests)
   */
  setAllowMockInProduction(allow: boolean): void {
    this.allowMockInProduction = allow;
  }
}

// Singleton instance
let registryInstance: AIProviderRegistry | null = null;

export function getAIProviderRegistry(): AIProviderRegistry {
  if (!registryInstance) {
    registryInstance = new AIProviderRegistry();
  }
  return registryInstance;
}

/**
 * Convenience function to get current provider
 */
export function getCurrentAIProvider(): AIProvider {
  return getAIProviderRegistry().getCurrentProvider();
}

/**
 * Convenience function to configure provider
 */
export function configureAIProvider(config: AIProviderConfig): void {
  getAIProviderRegistry().setProvider(config);
}

/**
 * Check if AI is available (real provider configured and ready)
 */
export function isAIAvailable(): boolean {
  return getAIProviderRegistry().hasRealProvider();
}

/**
 * Inspect detailed provider state (real vs mock vs not_configured vs unavailable)
 */
export function getAIProviderState(): AIProviderState {
  return getAIProviderRegistry().getProviderState();
}
