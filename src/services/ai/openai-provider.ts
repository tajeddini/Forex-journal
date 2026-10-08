// ============================================================
// OpenAI / Qwen / OpenRouter Compatible AI Provider Adapter
// Implements AIProvider interface using fetch
// Works with OpenAI, Qwen (DashScope / OpenRouter), DeepSeek
// ============================================================

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderType,
  AIGenerateOptions,
  AIResponse,
  AICapabilities,
  AISchemaDefinition,
} from './types';
import { AIError } from './types';

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly type: AIProviderType;

  private apiKey: string | null = null;
  private defaultModel: string;
  private baseUrl: string;

  constructor(
    type: 'openai' | 'qwen' | 'custom' = 'openai',
    config?: Partial<AIProviderConfig> & { baseUrl?: string }
  ) {
    this.type = type;
    this.name = type === 'qwen' ? 'Qwen / DashScope' : type === 'custom' ? 'Custom OpenAI-compatible' : 'OpenAI';

    const envKey =
      type === 'qwen'
        ? (typeof process !== 'undefined' ? process.env?.QWEN_API_KEY || process.env?.AI_API_KEY : null)
        : type === 'custom'
          ? null
          : (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY || process.env?.AI_API_KEY : null);

    this.apiKey =
      config && 'apiKey' in config
        ? config.apiKey || null
        : envKey || null;

    if (type === 'qwen') {
      this.defaultModel = config?.model || (typeof process !== 'undefined' ? process.env?.AI_MODEL : undefined) || 'qwen-plus';
      this.baseUrl = config?.baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
    } else if (type === 'custom') {
      this.defaultModel = config?.model || 'custom-model';
      this.baseUrl = (config?.baseUrl || '').replace(/\/+$/, '');
    } else {
      this.defaultModel = config?.model || (typeof process !== 'undefined' ? process.env?.AI_MODEL : undefined) || 'gpt-4o-mini';
      this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getCapabilities(): AICapabilities {
    return {
      textGeneration: true,
      structuredOutput: true,
      streaming: false,
      vision: false,
      functionCalling: true,
    };
  }

  private ensureConfig(): { apiKey: string; model: string; baseUrl: string } {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new AIError(
        `کلید دسترسی ${this.name} وارد نشده است. لطفاً کلید API را وارد کنید.`,
        'API_KEY_MISSING',
        this.type
      );
    }
    return {
      apiKey: this.apiKey,
      model: this.defaultModel,
      baseUrl: this.baseUrl,
    };
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AIResponse<string>> {
    const { apiKey, model, baseUrl } = this.ensureConfig();
    const startTime = Date.now();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional financial trading journal analyst. Provide structured, accurate, Persian analysis based strictly on the provided trading data facts.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 2000,
        }),
      });

      if (!response.ok) {
        let errJson: any = {};
        try {
          errJson = await response.json();
        } catch {
          // ignore
        }
        const msg = errJson?.error?.message || `HTTP error ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      const text = data.choices?.[0]?.message?.content || '';

      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined;

      return {
        data: text,
        latency,
        model,
        providerType: this.type,
        isMock: false,
        usage,
      };
    } catch (err: unknown) {
      throw this.mapError(err);
    }
  }

  async generateStructured<T>(
    prompt: string,
    _schema?: AISchemaDefinition,
    options?: AIGenerateOptions
  ): Promise<AIResponse<T>> {
    const { apiKey, model, baseUrl } = this.ensureConfig();
    const startTime = Date.now();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a financial analysis assistant. Output strictly valid JSON conforming to the requested schema. Do not include markdown codeblocks.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: options?.temperature ?? 0.1,
          max_tokens: options?.maxTokens ?? 2000,
        }),
      });

      if (!response.ok) {
        let errJson: any = {};
        try {
          errJson = await response.json();
        } catch {
          // ignore
        }
        const msg = errJson?.error?.message || `HTTP error ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;
      const rawText = data.choices?.[0]?.message?.content || '{}';

      let parsed: T;
      try {
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new AIError(
          'پاسخ دریافتی به صورت فرمت JSON معتبر نبود',
          'INVALID_RESPONSE',
          this.type,
          parseErr instanceof Error ? parseErr : undefined
        );
      }

      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined;

      return {
        data: parsed,
        latency,
        model,
        providerType: this.type,
        isMock: false,
        usage,
      };
    } catch (err: unknown) {
      if (err instanceof AIError) throw err;
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): AIError {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('api key') || lower.includes('401') || lower.includes('unauthorized')) {
      return new AIError(
        `کلید API سرویس ${this.name} نامعتبر یا منقضی شده است.`,
        'API_KEY_MISSING',
        this.type,
        err instanceof Error ? err : undefined
      );
    }

    if (lower.includes('rate limit') || lower.includes('429')) {
      return new AIError(
        `محدودیت تعداد درخواست یا سهمیه ${this.name} به پایان رسیده است.`,
        'RATE_LIMIT',
        this.type,
        err instanceof Error ? err : undefined
      );
    }

    if (lower.includes('timeout')) {
      return new AIError(
        `زمان انتظار برای پاسخ ${this.name} به پایان رسید.`,
        'TIMEOUT',
        this.type,
        err instanceof Error ? err : undefined
      );
    }

    return new AIError(
      `خطا در ارتباط با سرویس ${this.name}: ${msg}`,
      'PROVIDER_EXECUTION_ERROR',
      this.type,
      err instanceof Error ? err : undefined
    );
  }
}
