// ============================================================
// Mock AI Provider Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { MockAIProvider, getMockAIProvider } from './mock-provider';
import type { AISchemaDefinition } from './types';

describe('MockAIProvider', () => {
  describe('generateText', () => {
    it('should return mock text response', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      const response = await provider.generateText('تعداد معاملات من چقدر است؟');

      expect(response.data).toBeDefined();
      expect(typeof response.data).toBe('string');
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
      expect(response.model).toBe('mock-model-v1');
    });

    it('should return context-aware responses', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      
      const response1 = await provider.generateText('نرخ برد من چقدر است؟');
      expect(response1.data).toContain('نرخ برد');

      const response2 = await provider.generateText('عملکرد EURUSD من چطور بوده؟');
      expect(response2.data).toContain('EURUSD');
    });

    it('should simulate delay', async () => {
      const provider = new MockAIProvider({ responseDelay: 100 });
      const start = Date.now();
      
      await provider.generateText('test');
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('generateStructured', () => {
    it('should return structured response matching schema', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      
      const schema: AISchemaDefinition = {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['answer', 'confidence'],
      };

      const response = await provider.generateStructured('test', schema);
      
      expect(response.data).toBeDefined();
      expect(typeof response.data).toBe('object');
      expect((response.data as any).answer).toBeDefined();
      expect((response.data as any).confidence).toBeDefined();
    });

    it('should handle array schema', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      
      const schema: AISchemaDefinition = {
        type: 'array',
        items: {
          type: 'string'
        }
      };

      const response = await provider.generateStructured('test', schema);
      
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should respect enum values', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      
      const schema: AISchemaDefinition = {
        type: 'string',
        enum: ['buy', 'sell', 'hold']
      };

      const response = await provider.generateStructured('test', schema);
      
      expect(['buy', 'sell', 'hold']).toContain(response.data);
    });
  });

  describe('streamText', () => {
    it('should stream text chunks', async () => {
      const provider = new MockAIProvider({ responseDelay: 10 });
      const chunks: string[] = [];

      for await (const chunk of provider.streamText!('test prompt')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain(' ');
    });
  });

  describe('isAvailable', () => {
    it('should always return true for mock provider', () => {
      const provider = new MockAIProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const provider = new MockAIProvider();
      const capabilities = provider.getCapabilities();

      expect(capabilities.textGeneration).toBe(true);
      expect(capabilities.structuredOutput).toBe(true);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.vision).toBe(false);
      expect(capabilities.functionCalling).toBe(false);
    });
  });

  describe('getMockAIProvider', () => {
    it('should return singleton instance', () => {
      const provider1 = getMockAIProvider();
      const provider2 = getMockAIProvider();

      expect(provider1).toBe(provider2);
    });
  });
});
