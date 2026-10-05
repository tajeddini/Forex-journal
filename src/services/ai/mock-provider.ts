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
      providerType: 'mock',
      isMock: true,
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
      providerType: 'mock',
      isMock: true,
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
      return 'بر اساس داده‌های موجود، شما در دوره مشخص شده ۴۵ معامله داشته‌اید که نشان‌دهنده فعالیت منظم در بازار است.';
    }

    if (lowerPrompt.includes('نرخ برد') || lowerPrompt.includes('win rate')) {
      return 'نرخ برد شما در این دوره ۶۲.۵٪ بوده است که بالاتر از میانگین معمول است و نشان‌دهنده کیفیت مناسب ستاپ‌های انتخابی می‌باشد.';
    }

    if (lowerPrompt.includes('eurusd')) {
      return 'عملکرد شما در جفت‌ارز EURUSD شامل ۱۲ معامله با نرخ برد ۶۶.۷٪ و سود خالص ۳۵۰ دلار بوده است. این جفت‌ارز یکی از پربازده‌ترین دارایی‌های شماست.';
    }

    if (lowerPrompt.includes('جمعه') || lowerPrompt.includes('friday')) {
      return 'در روزهای جمعه شما ۸ معامله انجام داده‌اید با نرخ برد ۵۰٪. توصیه می‌شود در ساعات پایانی روز جمعه به دلیل کاهش نقدینگی و نوسانات نامنظم، حجم معاملات را کاهش دهید.';
    }

    if (lowerPrompt.includes('استراتژی') || lowerPrompt.includes('strategy')) {
      return 'استراتژی Breakout شما بیشترین تعداد معامله (۲۰ معامله) را داشته است و بالاترین سودآوری تجمعی را ایجاد کرده است.';
    }

    if (lowerPrompt.includes('پیشنهاد') || lowerPrompt.includes('توصیه') || lowerPrompt.includes('suggest') || lowerPrompt.includes('recommend')) {
      return 'پیشنهاد می‌شود به قوانین مدیریت ریسک و حفظ حداکثر ۱٪ سرمایه در هر پوزیشن پایبند بمانید، از ورودهای پرریسک در ساعات غیرسشن خودداری فرمایید و پس از دو معامله زیان‌ده متوالی، معاملات روزانه را متوقف کنید.';
    }

    // Default response in fluent Persian
    return 'بر اساس بررسی عملکرد معاملاتی شما، روند کلی مثبت است. پیشنهاد می‌شود برای حفظ پایداری حساب، بر روی ستاپ‌های با نسبت ریسک به ریوارد حداقل ۱ به ۲ تمرکز کرده و از معاملات هیجانی در زمان انتشار اخبار پرنوسان پرهیز نمایید.';
  }

  private generateMockStructuredResponse<T>(schema: AISchemaDefinition): T {
    // Generate mock data based on schema type
    if (schema.type === 'object') {
      const result: Record<string, any> = {};
      
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          // Provide context-aware Persian content for key fields
          if (key === 'recommendations') {
            result[key] = [
              'میزان ریسک در هر معامله را حداکثر روی ۱ تا ۱.۵ درصد بالانس حفظ کنید.',
              'بر روی ساعات آغازین سشن لندن و نیویورک تمرکز کنید و از معاملات قبل از اخبار مهم دوری نمایید.',
              'معاملات کوتاه‌مدت زیر ۳ دقیقه را محدود کنید تا از خطاهای هیجانی جلوگیری شود.',
            ];
          } else if (key === 'observations') {
            result[key] = [
              'بیشترین بازدهی و نرخ برد در جفت‌ارزهای ماژور ثبت شده است.',
              'معاملات پوزیشن خرید با پایبندی بالاتر به استراتژی همراه بوده‌اند.',
              'حفظ خونسردی و یادداشت منظم وقایع در ژورنال نتایج را بهبود داده است.',
            ];
          } else if (key === 'suggestions') {
            result[key] = [
              {
                tagName: 'ستاپ تایید شده',
                reason: 'تمام معیارهای چک‌لیست استراتژی ورود رعایت شده است.',
                confidence: 90,
              },
              {
                tagName: 'مدیریت ریسک هوشمند',
                reason: 'حد ضرر و حد سود طبق استاندارد برنامه معاملاتی تنظیم گردیده است.',
                confidence: 85,
              },
            ];
          } else if (key === 'summary') {
            result[key] = 'خلاصه تحلیل: انضباط معاملاتی مطلوب با نرخ سودآوری پایدار در سشن‌های اصلی.';
          } else {
            result[key] = this.generateMockValue(prop);
          }
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
        return 'تحلیل و پیشنهاد معاملاتی هوشمند به زبان فارسی';
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
        return ['پیشنهاد اول: رعایت حد ضرر روزانه', 'پیشنهاد دوم: ثبت منظم بازبینی ژورنال'];
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
