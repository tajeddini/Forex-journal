import type { AIProvider, AIProviderConfig, AIGenerateOptions, AIResponse, AICapabilities, AISchemaDefinition } from './types';
import { AIError } from './types';

export class ClaudeAIProvider implements AIProvider {
  readonly name = 'Anthropic Claude';
  readonly type = 'claude' as const;
  private apiKey: string | null;
  private defaultModel: string;
  private baseUrl: string;

  constructor(config?: Partial<AIProviderConfig>) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || null;
    this.defaultModel = config?.model || process.env.AI_MODEL || 'claude-3-5-sonnet-latest';
    this.baseUrl = (config?.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  }

  isAvailable(): boolean { return Boolean(this.apiKey?.trim()); }

  getCapabilities(): AICapabilities {
    return { textGeneration: true, structuredOutput: true, streaming: false, vision: false, functionCalling: true };
  }

  private config() {
    if (!this.apiKey?.trim()) throw new AIError('کلید دسترسی Claude وارد نشده است.', 'API_KEY_MISSING', 'claude');
    return { apiKey: this.apiKey, model: this.defaultModel, baseUrl: this.baseUrl };
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AIResponse<string>> {
    const { apiKey, model, baseUrl } = this.config();
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: options?.maxTokens ?? 2000, temperature: options?.temperature ?? 0.3,
          system: 'You are a professional financial trading journal analyst. Use only the supplied deterministic facts and never execute trades or modify records.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `HTTP error ${response.status}`);
      const text = Array.isArray(data.content) ? data.content.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join('') : '';
      return { data: text, latency: Date.now() - start, model, providerType: 'claude', isMock: false,
        usage: data.usage ? { promptTokens: data.usage.input_tokens || 0, completionTokens: data.usage.output_tokens || 0, totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) } : undefined };
    } catch (err) { throw this.mapError(err); }
  }

  async generateStructured<T>(prompt: string, _schema?: AISchemaDefinition, options?: AIGenerateOptions): Promise<AIResponse<T>> {
    const result = await this.generateText(`${prompt}\n\nReturn only valid JSON. Do not use markdown fences.`, options);
    try { return { ...result, data: JSON.parse(result.data.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()) as T }; }
    catch (err) { throw new AIError('پاسخ Claude به صورت JSON معتبر نبود.', 'INVALID_RESPONSE', 'claude', err instanceof Error ? err : undefined); }
  }

  private mapError(err: unknown): AIError {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (lower.includes('401') || lower.includes('403') || lower.includes('api key') || lower.includes('authentication')) return new AIError('کلید Claude نامعتبر یا منقضی شده است.', 'API_KEY_MISSING', 'claude', err instanceof Error ? err : undefined);
    if (lower.includes('429') || lower.includes('rate limit')) return new AIError('محدودیت سهمیه Claude اعمال شده است.', 'RATE_LIMIT', 'claude', err instanceof Error ? err : undefined);
    if (lower.includes('timeout')) return new AIError('زمان انتظار Claude به پایان رسید.', 'TIMEOUT', 'claude', err instanceof Error ? err : undefined);
    return new AIError(`خطا در ارتباط با Claude: ${msg}`, 'PROVIDER_EXECUTION_ERROR', 'claude', err instanceof Error ? err : undefined);
  }
}
