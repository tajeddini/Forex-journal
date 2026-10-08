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
    schema?: AISchemaDefinition,
    options?: AIGenerateOptions
  ): Promise<AIResponse<T>> {
    await this.simulateDelay();

    // Generate mock structured response based on schema
    const response = this.generateMockStructuredResponse<T>(schema, prompt);

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

  private generateMockStructuredResponse<T>(schema?: AISchemaDefinition, prompt?: string): T {
    if (!schema) {
      const isPeriodic = prompt && (prompt.includes('گزارش') || prompt.includes('دوره') || prompt.includes('هفتگی') || prompt.includes('ماهانه') || prompt.includes('PERIODIC_REPORT'));
      if (isPeriodic) {
        return {
          title: 'گزارش تحلیلی دوره',
          period: 'دوره انتخابی',
          sampleSize: 10,
          summary: 'خلاصه عملکرد دوره بر اساس آمار قطعی ثبت‌شده.',
          keyMetrics: { totalTrades: 10, winRate: 60, netPnl: 350 },
          performanceInterpretation: 'عملکرد این دوره بر مبنای داده‌های موجود ارزیابی شده است.',
          strongBehaviors: ['ورود با تاییدیه ستاپ'],
          biggestProblems: ['خروج زودهنگام از معاملات'],
          strategyAnalysis: ['استراتژی بریک‌اوت بازدهی مناسبی داشته است.'],
          psychologyAnalysis: ['انضباط و خونسردی در مدیریت معاملات مشاهده می‌شود.'],
          riskManagementAnalysis: ['ریسک در محدوده مجاز کنترل شده است.'],
          repeatedMistakes: ['بستن دستی قبل از تارگت'],
          topPriorities: [
            'تمرکز کامل بر روی ستاپ‌های اختصاصی',
            'حذف معاملات انتقامی پس از استاپ',
            'تکمیل منظم ژورنال پس از هر معامله',
          ],
          observations: ['بیشترین بازدهی در سشن اصلی بوده است.'],
          recommendations: ['رعایت حد ضرر روزانه', 'ثبت دقیق بازبینی'],
          limitations: ['حجم نمونه برای نتیجه‌گیری آماری بلندمدت اندک است.'],
        } as unknown as T;
      }

      return {
        summary: 'خلاصه تحلیل هوشمند: عملکرد کلی مطلوب و منطبق بر مدیریت ریسک است.',
        whatWentWell: ['ورود با تاییدیه', 'پایبندی به حد ضرر'],
        whatCouldBeImproved: ['خروج زودهنگام قبل از رسیدن به تارگت'],
        ruleAdherenceAnalysis: { status: 'followed', explanation: 'قوانین رعایت شده است.' },
        riskManagementAnalysis: { assessment: 'ریسک کنترل‌شده و در محدوده مجاز بوده است.' },
        psychologyAnalysis: { observedEmotions: ['آرام'], assessment: 'انضباط و خونسردی مطلوب' },
        actionableLessons: [
          'پایبندی بدون تغییر به حد ضرر تعیین‌شده',
          'عدم افزایش حجم پس از معاملات سودده',
          'مرور ستاپ قبل از ورود به پوزیشن',
        ],
        facts: ['نماد و جهت معامله ثبت گردیده است.'],
        observations: ['بیشترین سودآوری در ساعات میانی ثبت شده است.'],
        possiblePatterns: ['الگوی پولبک با بالاترین دقت همراه بوده است.'],
        questionsForTrader: ['آیا استاپ‌لاس در حین معامله جابجا شد؟'],
        limitations: ['حجم نمونه برای نتیجه‌گیری آماری بلندمدت اندک است.'],
        suggestions: [
          { tagName: 'ستاپ تایید شده', reason: 'معیارهای ورود رعایت شده است.', confidence: 90, type: 'tag', isExisting: true },
          { tagName: 'مدیریت ریسک هوشمند', reason: 'ریسک مجاز بوده است.', confidence: 85, type: 'tag', isExisting: true },
        ],
        title: 'گزارش تحلیلی دوره',
        period: 'دوره انتخابی',
        sampleSize: 10,
        keyMetrics: { totalTrades: 10, winRate: 60, netPnl: 350 },
        recommendations: ['رعایت حد ضرر روزانه', 'ثبت دقیق بازبینی'],
        topPriorities: [
          'تمرکز کامل بر روی ستاپ‌های اختصاصی',
          'حذف معاملات انتقامی پس از استاپ',
          'تکمیل منظم ژورنال پس از هر معامله',
        ],
      } as unknown as T;
    }

    // Generate mock data based on schema type
    if (schema.type === 'object') {
      const result: Record<string, any> = {};
      
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          // Provide context-aware Persian content for key fields
          if (key === 'actionableLessons') {
            result[key] = [
              'پایبندی بدون چون‌وچرا به حد ضرر تعیین‌شده در ورود معامله',
              'عدم تغییر تارگت و حجم پوزیشن بر اساس هیجان یا نوسانات میان‌روزی',
              'انتظار برای تثبیت کامل کندل تاییدیه قبل از فشردن کلید ورود',
            ];
          } else if (key === 'whatWentWell') {
            result[key] = [
              'تعیین مشخص حد ضرر قبل از ارسال سفارش به بازار',
              'انتخاب ستاپ معاملاتی هماهنگ با تایم‌فریم اصلی',
            ];
          } else if (key === 'whatCouldBeImproved') {
            result[key] = [
              'خروج زودهنگام قبل از رسیدن به حد سود تعیین‌شده',
              'توجه بیشتر به اخبار میان‌روزی و تأثیر آن بر اسپرد معاملاتی',
            ];
          } else if (key === 'ruleAdherenceAnalysis') {
            result[key] = {
              status: 'followed',
              explanation: 'معامله با رعایت کامل چک‌لیست و قوانین استراتژی انجام شده است.',
            };
          } else if (key === 'riskManagementAnalysis') {
            if (prop.type === 'array') {
              result[key] = ['ریسک کنترل‌شده و در محدوده استاندارد حفظ شده است.'];
            } else {
              result[key] = {
                plannedRisk: '1.0%',
                actualRisk: '0.8%',
                riskRewardRatio: '1:2',
                assessment: 'مدیریت ریسک در این پوزیشن در محدوده ایمن و استاندارد پلن معاملاتی قرار داشته است.',
              };
            }
          } else if (key === 'psychologyAnalysis') {
            if (prop.type === 'array') {
              result[key] = ['انضباط و خونسردی در مدیریت معاملات مشاهده می‌شود.'];
            } else {
              result[key] = {
                observedEmotions: ['آرام', 'مطمئن'],
                assessment: 'ثبت منظم هیجانات نشان‌دهنده آرامش و انضباط فکری در زمان ورود و مدیریت این پوزیشن است.',
              };
            }
          } else if (key === 'facts') {
            result[key] = [
              'نماد و جهت معامله طبق داده‌های برخط صرافی/بروکر ثبت گردیده است.',
              'حجم معامله و قیمت ورود و خروج کاملاً مطابق با متاتریدر است.',
            ];
          } else if (key === 'recommendations') {
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
                type: 'tag',
                isExisting: true,
              },
              {
                tagName: 'مدیریت ریسک هوشمند',
                reason: 'حد ضرر و حد سود طبق استاندارد برنامه معاملاتی تنظیم گردیده است.',
                confidence: 85,
                type: 'tag',
                isExisting: true,
              },
            ];
          } else if (key === 'summary') {
            result[key] = 'خلاصه تحلیل: انضباط معاملاتی مطلوب با نرخ سودآوری پایدار در سشن‌های اصلی.';
          } else if (key === 'topPriorities') {
            result[key] = [
              'اولیت اول: تمرکز کامل بر روی پایبندی به حد ضرر در تمامی نمادها',
              'اولویت دوم: حذف پوزیشن‌های پرریسک در ساعات پایانی جمعه',
              'اولویت سوم: یادداشت منظم بازبینی پس از معامله بلافاصله پس از خروج',
            ];
          } else if (key === 'limitations') {
            result[key] = [
              'تحلیل بر اساس معاملات ثبت‌شده در این بازه انجام شده و نمونه‌های کم‌تعداد الگوهای قطعی ایجاد نمی‌کنند.',
            ];
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
