// ============================================================
// AI Provider Registry
// Manages AI provider instances and selection
// ============================================================

import type { AIProvider, AIProviderConfig, AIProviderType } from './types';
import { getMockAIProvider } from './mock-provider';

class AIProviderRegistry {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private currentProvider: AIProvider | null = null;
  private currentConfig: AIProviderConfig | null = null;

  constructor() {
    // Register mock provider by default
    this.registerProvider(getMockAIProvider());
    this.currentProvider = getMockAIProvider();
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
   * Get the current active provider
   */
  getCurrentProvider(): AIProvider {
    if (!this.currentProvider) {
      // Fallback to mock provider
      return getMockAIProvider();
    }
    return this.currentProvider;
  }

  /**
   * Set the active provider by configuration
   */
  setProvider(config: AIProviderConfig): void {
    const provider = this.providers.get(config.type);
    
    if (!provider) {
      console.warn(`Provider ${config.type} not registered, falling back to mock`);
      this.currentProvider = getMockAIProvider();
      this.currentConfig = { type: 'mock' };
      return;
    }

    // Check if provider is available (e.g., API key present)
    if (!provider.isAvailable()) {
      console.warn(`Provider ${config.type} not available, falling back to mock`);
      this.currentProvider = getMockAIProvider();
      this.currentConfig = { type: 'mock' };
      return;
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
   * Check if a real (non-mock) provider is configured
   */
  hasRealProvider(): boolean {
    return this.currentProvider !== null && this.currentProvider.type !== 'mock';
  }

  /**
   * Get all registered provider types
   */
  getRegisteredProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Reset to mock provider
   */
  resetToMock(): void {
    this.currentProvider = getMockAIProvider();
    this.currentConfig = { type: 'mock' };
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
 * Check if AI is available (real provider configured)
 */
export function isAIAvailable(): boolean {
  return getAIProviderRegistry().hasRealProvider();
}
