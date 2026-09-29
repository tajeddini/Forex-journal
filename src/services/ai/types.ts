// ============================================================
// AI Types and Interfaces
// Provider-agnostic AI architecture foundation
// ============================================================

// --- Provider Types ---

export type AIProviderType = 'mock' | 'openai' | 'qwen' | 'gemini' | 'claude' | 'custom';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string; // Optional - mock provider doesn't need it
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  readonly type: AIProviderType;
  
  generateText(prompt: string, options?: AIGenerateOptions): Promise<AIResponse<string>>;
  generateStructured<T>(prompt: string, schema: AISchemaDefinition, options?: AIGenerateOptions): Promise<AIResponse<T>>;
  streamText?(prompt: string, options?: AIGenerateOptions): AsyncIterable<string>;
  
  isAvailable(): boolean;
  getCapabilities(): AICapabilities;
}

export interface AIGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  timeout?: number;
}

export interface AIResponse<T> {
  data: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  latency?: number;
}

export interface AICapabilities {
  textGeneration: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
}

// --- Schema Definition ---

export interface AISchemaDefinition {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  description?: string;
  properties?: Record<string, AISchemaDefinition>;
  items?: AISchemaDefinition;
  required?: string[];
  enum?: string[];
}

// --- Query DSL ---

export type AIMetric = 
  | 'totalTrades'
  | 'winRate'
  | 'netPnl'
  | 'grossProfit'
  | 'grossLoss'
  | 'profitFactor'
  | 'expectancy'
  | 'averageWin'
  | 'averageLoss'
  | 'maxDrawdown'
  | 'averageDuration'
  | 'medianDuration';

export type AIDimension = 
  | 'symbol'
  | 'side'
  | 'strategy'
  | 'setup'
  | 'account'
  | 'phase'
  | 'hour'
  | 'dayOfWeek'
  | 'month'
  | 'ruleAdherence'
  | 'result'
  | 'durationBucket';

export type AIFilterOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'between';

export interface AIFilter {
  field: AIDimension | 'date';
  operator: AIFilterOperator;
  value: string | number | string[] | number[] | [string, string];
}

export interface AIQueryPlan {
  metrics: AIMetric[];
  dimensions?: AIDimension[];
  filters?: AIFilter[];
  dateRange?: {
    start: string;
    end: string;
  };
  groupBy?: AIDimension;
  sortBy?: {
    field: AIMetric | AIDimension;
    order: 'asc' | 'desc';
  };
  limit?: number;
}

// --- AI Feature Types ---

export type AIFeatureType = 
  | 'ai_query'
  | 'ai_trade_review'
  | 'ai_auto_tagging'
  | 'ai_weekly_review'
  | 'ai_monthly_review'
  | 'ai_pattern_analysis'
  | 'ai_chart_generation';

export interface AIFeatureConfig {
  type: AIFeatureType;
  enabled: boolean;
  requiresConfirmation: boolean;
  allowsMutation: boolean;
  allowsScreenshots: boolean;
  maxContextSize: number;
  maxOutputSize: number;
}

// --- Response Schemas ---

export interface AIQueryResponse {
  answer: string;
  queryPlan: AIQueryPlan;
  dataSummary: {
    sampleSize: number;
    period: string;
    metrics: Record<string, number | null>;
  };
  chart?: {
    type: string;
    config: Record<string, any>;
  };
  limitations?: string[];
  confidenceNote?: string;
}

export interface AITradeReviewResponse {
  facts: string[];
  observations: string[];
  possiblePatterns: string[];
  questionsForTrader: string[];
  limitations: string[];
}

export interface AIAutoTagResponse {
  suggestions: Array<{
    tagId?: string;
    tagName: string;
    reason: string;
    confidence?: number;
  }>;
}

export interface AIReportResponse {
  title: string;
  period: string;
  sampleSize: number;
  summary: string;
  keyMetrics: Record<string, any>;
  observations: string[];
  recommendations: string[];
  limitations: string[];
}

// --- Context Types ---

export interface AIContext {
  userId: string;
  accountId?: string;
  phaseId?: string;
  period?: {
    start: string;
    end: string;
  };
  sampleSize: number;
  metrics: Record<string, any>;
  breakdowns?: Record<string, any>;
  trades?: Array<Record<string, any>>; // Limited, sanitized trade data
}

// --- Error Types ---

export class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public provider?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export type AIErrorCode = 
  | 'PROVIDER_UNAVAILABLE'
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'CONTEXT_TOO_LARGE'
  | 'QUERY_VALIDATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

// --- Validation Types ---

export interface AIValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
