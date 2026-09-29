// ============================================================
// Mock AI Provider
// For development and testing without external API
// ============================================================

import type { AIProvider, AIResponse, AIGenerateOptions, AICapabilities, AISchemaDefinition } from './types';

export class MockAIProvider implements AIProvider {
  readonly name = 'Mock AI Provider';
  readonly type = 'mock' as const;

  private responseDelay: number;

  constructor(options?: { responseDelay?: number }) {
    this.responseDelay = options?.responseDelay ?? 100;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AIResponse<string>> {
    await this.simulateDelay();

    // Return deterministic mock response based on prompt
    const response = this.generateMockTextResponse(prompt);

    return {
      data: response,
      usage: {
        promptTokens: prompt.length,
        completionTokens: response.length,
        totalTokens: prompt.length + response.length,
      },
      model: 'mock-model-v1',
      latency: this.responseDelay,
    };
  }

  async generateStructured<T>(
    prompt: string,
    schema: AISchemaDefinition,
    options?: AIGenerateOptions
  ): Promise<AIResponse<T>> {
    await this.simulateDelay();

    // Generate mock structured response based on schema
    const response = this.generateMockStructuredResponse<T>(schema);

    return {
      data: response,
      usage: {
        promptTokens: prompt.length,
        completionTokens: JSON.stringify(response).length,
        totalTokens: prompt.length + JSON.stringify(response).length,
      },
      model: 'mock-model-v1',
      latency: this.responseDelay,
    };
  }

  async *streamText(prompt: string, options?: AIGenerateOptions): AsyncIterable<string> {
    const response = this.generateMockTextResponse(prompt);
    const words = response.split(' ');

    for (const word of words) {
      await this.simulateDelay(50);
      yield word + ' ';
    }
  }

  isAvailable(): boolean {
    return true; // Mock provider is always available
  }

  getCapabilities(): AICapabilities {
    return {
      textGeneration: true,
      structuredOutput: true,
      streaming: true,
      vision: false,
      functionCalling: false,
    };
  }

  // --- Private Helper Methods ---

  private async simulateDelay(ms?: number): Promise<void> {
    const delay = ms ?? this.responseDelay;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateMockTextResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Simple pattern matching for common queries
    if (lowerPrompt.includes('تعداد معاملات') || lowerPrompt.includes('how many trades')) {
      return 'بر اساس داده‌های موجود، شما در دوره مشخص شده ۴۵ معامله داشته‌اید.';
    }

    if (lowerPrompt.includes('نرخ برد') || lowerPrompt.includes('win rate')) {
      return 'نرخ برد شما در این دوره ۶۲.۵٪ بوده است که بالاتر از میانگین معمول است.';
    }

    if (lowerPrompt.includes('eurusd')) {
      return 'عملکرد شما در EURUSD شامل ۱۲ معامله با نرخ برد ۶۶.۷٪ و سود خالص ۳۵۰ دلار بوده است.';
    }

    if (lowerPrompt.includes('جمعه') || lowerPrompt.includes('friday')) {
      return 'در روزهای جمعه شما ۸ معامله انجام داده‌اید با نرخ برد ۵۰٪.';
    }

    if (lowerPrompt.includes('استراتژی') || lowerPrompt.includes('strategy')) {
      return 'استراتژی Breakout شما بیشترین تعداد معامله (۲۰ معامله) را داشته است.';
    }

    // Default response
    return 'این یک پاسخ نمونه از Mock AI Provider است. برای دریافت پاسخ‌های واقعی، لطفاً یک provider واقعی مانند OpenAI یا Qwen را پیکربندی کنید.';
  }

  private generateMockStructuredResponse<T>(schema: AISchemaDefinition): T {
    // Generate mock data based on schema type
    if (schema.type === 'object') {
      const result: Record<string, any> = {};
      
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          result[key] = this.generateMockValue(prop);
        }
      }
      
      return result as T;
    }

    if (schema.type === 'array' && schema.items) {
      const items = [];
      for (let i = 0; i < 3; i++) {
        items.push(this.generateMockValue(schema.items));
      }
      return items as T;
    }

    return this.generateMockValue(schema) as T;
  }

  private generateMockValue(schema: AISchemaDefinition): any {
    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    switch (schema.type) {
      case 'string':
        return 'نمونه متن';
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'object':
        const obj: Record<string, any> = {};
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this.generateMockValue(prop);
          }
        }
        return obj;
      case 'array':
        return [];
      default:
        return null;
    }
  }
}

// Singleton instance
let mockProviderInstance: MockAIProvider | null = null;

export function getMockAIProvider(): MockAIProvider {
  if (!mockProviderInstance) {
    mockProviderInstance = new MockAIProvider();
  }
  return mockProviderInstance;
}
