// ============================================================
// AI Feature Registry
// Manages AI feature availability and configuration
// ============================================================

import type { AIFeatureType, AIFeatureConfig } from './types';

// Default feature configurations (safe defaults)
const DEFAULT_FEATURE_CONFIGS: Record<AIFeatureType, AIFeatureConfig> = {
  ai_query: {
    type: 'ai_query',
    enabled: false, // Disabled by default
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 4000,
    maxOutputSize: 2000,
  },
  ai_trade_review: {
    type: 'ai_trade_review',
    enabled: false,
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 6000,
    maxOutputSize: 3000,
  },
  ai_auto_tagging: {
    type: 'ai_auto_tagging',
    enabled: false,
    requiresConfirmation: true, // User must approve suggestions
    allowsMutation: false, // Only suggestions, no auto-mutation
    allowsScreenshots: false,
    maxContextSize: 3000,
    maxOutputSize: 1000,
  },
  ai_weekly_review: {
    type: 'ai_weekly_review',
    enabled: false,
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 8000,
    maxOutputSize: 4000,
  },
  ai_monthly_review: {
    type: 'ai_monthly_review',
    enabled: false,
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 10000,
    maxOutputSize: 5000,
  },
  ai_pattern_analysis: {
    type: 'ai_pattern_analysis',
    enabled: false,
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 8000,
    maxOutputSize: 3000,
  },
  ai_chart_generation: {
    type: 'ai_chart_generation',
    enabled: false,
    requiresConfirmation: false,
    allowsMutation: false,
    allowsScreenshots: false,
    maxContextSize: 4000,
    maxOutputSize: 2000,
  },
};

class AIFeatureRegistry {
  private features: Map<AIFeatureType, AIFeatureConfig> = new Map();

  constructor() {
    // Initialize with default configurations
    for (const [type, config] of Object.entries(DEFAULT_FEATURE_CONFIGS)) {
      this.features.set(type as AIFeatureType, { ...config });
    }
  }

  /**
   * Get feature configuration
   */
  getFeature(type: AIFeatureType): AIFeatureConfig | undefined {
    return this.features.get(type);
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(type: AIFeatureType): boolean {
    const feature = this.features.get(type);
    return feature?.enabled ?? false;
  }

  /**
   * Enable a feature
   */
  enableFeature(type: AIFeatureType): void {
    const feature = this.features.get(type);
    if (feature) {
      feature.enabled = true;
    }
  }

  /**
   * Disable a feature
   */
  disableFeature(type: AIFeatureType): void {
    const feature = this.features.get(type);
    if (feature) {
      feature.enabled = false;
    }
  }

  /**
   * Update feature configuration
   */
  updateFeatureConfig(type: AIFeatureType, updates: Partial<AIFeatureConfig>): void {
    const feature = this.features.get(type);
    if (feature) {
      this.features.set(type, { ...feature, ...updates });
    }
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): AIFeatureType[] {
    const enabled: AIFeatureType[] = [];
    for (const [type, config] of this.features.entries()) {
      if (config.enabled) {
        enabled.push(type);
      }
    }
    return enabled;
  }

  /**
   * Get all features
   */
  getAllFeatures(): AIFeatureConfig[] {
    return Array.from(this.features.values());
  }

  /**
   * Check if feature allows mutation
   */
  allowsMutation(type: AIFeatureType): boolean {
    const feature = this.features.get(type);
    return feature?.allowsMutation ?? false;
  }

  /**
   * Check if feature requires user confirmation
   */
  requiresConfirmation(type: AIFeatureType): boolean {
    const feature = this.features.get(type);
    return feature?.requiresConfirmation ?? true;
  }

  /**
   * Check if feature allows screenshots
   */
  allowsScreenshots(type: AIFeatureType): boolean {
    const feature = this.features.get(type);
    return feature?.allowsScreenshots ?? false;
  }

  /**
   * Get max context size for feature
   */
  getMaxContextSize(type: AIFeatureType): number {
    const feature = this.features.get(type);
    return feature?.maxContextSize ?? 4000;
  }

  /**
   * Get max output size for feature
   */
  getMaxOutputSize(type: AIFeatureType): number {
    const feature = this.features.get(type);
    return feature?.maxOutputSize ?? 2000;
  }

  /**
   * Reset all features to default (disabled)
   */
  resetToDefaults(): void {
    for (const [type, config] of Object.entries(DEFAULT_FEATURE_CONFIGS)) {
      this.features.set(type as AIFeatureType, { ...config });
    }
  }
}

// Singleton instance
let featureRegistryInstance: AIFeatureRegistry | null = null;

export function getAIFeatureRegistry(): AIFeatureRegistry {
  if (!featureRegistryInstance) {
    featureRegistryInstance = new AIFeatureRegistry();
  }
  return featureRegistryInstance;
}

/**
 * Convenience function to check if feature is enabled
 */
export function isAIFeatureEnabled(type: AIFeatureType): boolean {
  return getAIFeatureRegistry().isFeatureEnabled(type);
}

/**
 * Convenience function to enable feature
 */
export function enableAIFeature(type: AIFeatureType): void {
  getAIFeatureRegistry().enableFeature(type);
}

/**
 * Convenience function to disable feature
 */
export function disableAIFeature(type: AIFeatureType): void {
  getAIFeatureRegistry().disableFeature(type);
}
