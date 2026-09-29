// ============================================================
// Query Validator
// Validates AI-generated query plans before execution
// ============================================================

import type { AIQueryPlan, AIMetric, AIDimension, AIFilter, AIValidationResult } from './types';

// Allowlisted metrics
const ALLOWED_METRICS: Set<AIMetric> = new Set([
  'totalTrades',
  'winRate',
  'netPnl',
  'grossProfit',
  'grossLoss',
  'profitFactor',
  'expectancy',
  'averageWin',
  'averageLoss',
  'maxDrawdown',
  'averageDuration',
  'medianDuration',
]);

// Allowlisted dimensions
const ALLOWED_DIMENSIONS: Set<AIDimension> = new Set([
  'symbol',
  'side',
  'strategy',
  'setup',
  'account',
  'phase',
  'hour',
  'dayOfWeek',
  'month',
  'ruleAdherence',
  'result',
  'durationBucket',
]);

// Allowlisted filter operators
const ALLOWED_OPERATORS = new Set(['equals', 'not_equals', 'in', 'not_in', 'greater_than', 'less_than', 'between']);

// Maximum limits
const MAX_LIMIT = 1000;
const MAX_FILTERS = 10;
const MAX_METRICS = 10;
const MAX_DIMENSIONS = 5;

/**
 * Validate an AI-generated query plan
 */
export function validateQueryPlan(query: AIQueryPlan): AIValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate metrics
  if (!query.metrics || query.metrics.length === 0) {
    errors.push('حداقل یک metric باید مشخص شود');
  } else if (query.metrics.length > MAX_METRICS) {
    errors.push(`حداکثر ${MAX_METRICS} metric مجاز است`);
  } else {
    for (const metric of query.metrics) {
      if (!ALLOWED_METRICS.has(metric)) {
        errors.push(`Metric نامعتبر: ${metric}`);
      }
    }
  }

  // Validate dimensions
  if (query.dimensions && query.dimensions.length > MAX_DIMENSIONS) {
    errors.push(`حداکثر ${MAX_DIMENSIONS} dimension مجاز است`);
  }
  if (query.dimensions) {
    for (const dimension of query.dimensions) {
      if (!ALLOWED_DIMENSIONS.has(dimension)) {
        errors.push(`Dimension نامعتبر: ${dimension}`);
      }
    }
  }

  // Validate groupBy
  if (query.groupBy && !ALLOWED_DIMENSIONS.has(query.groupBy)) {
    errors.push(`GroupBy dimension نامعتبر: ${query.groupBy}`);
  }

  // Validate filters
  if (query.filters && query.filters.length > MAX_FILTERS) {
    errors.push(`حداکثر ${MAX_FILTERS} filter مجاز است`);
  }
  if (query.filters) {
    for (const filter of query.filters) {
      const filterError = validateFilter(filter);
      if (filterError) {
        errors.push(filterError);
      }
    }
  }

  // Validate dateRange
  if (query.dateRange) {
    const dateError = validateDateRange(query.dateRange);
    if (dateError) {
      errors.push(dateError);
    }
  }

  // Validate limit
  if (query.limit !== undefined) {
    if (query.limit <= 0) {
      errors.push('Limit باید مثبت باشد');
    } else if (query.limit > MAX_LIMIT) {
      warnings.push(`Limit بسیار بزرگ است. حداکثر ${MAX_LIMIT} توصیه می‌شود`);
    }
  }

  // Validate sortBy
  if (query.sortBy) {
    if (query.sortBy.order !== 'asc' && query.sortBy.order !== 'desc') {
      errors.push('Sort order باید asc یا desc باشد');
    }
    // Check if sort field is valid
    const sortField = query.sortBy.field;
    if (!ALLOWED_METRICS.has(sortField as AIMetric) && !ALLOWED_DIMENSIONS.has(sortField as AIDimension)) {
      errors.push(`Sort field نامعتبر: ${sortField}`);
    }
  }

  // Security checks
  const securityErrors = performSecurityChecks(query);
  errors.push(...securityErrors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single filter
 */
function validateFilter(filter: AIFilter): string | null {
  // Check field
  const allowedFields = new Set<string>([...ALLOWED_DIMENSIONS, 'date']);
  if (!allowedFields.has(filter.field)) {
    return `فیلد فیلتر نامعتبر: ${filter.field}`;
  }

  // Check operator
  if (!ALLOWED_OPERATORS.has(filter.operator)) {
    return `عملگر فیلتر نامعتبر: ${filter.operator}`;
  }

  // Check value based on operator
  if (filter.operator === 'between') {
    if (!Array.isArray(filter.value) || filter.value.length !== 2) {
      return `عملگر between نیاز به آرایه دو مقداری دارد`;
    }
  } else if (filter.operator === 'in' || filter.operator === 'not_in') {
    if (!Array.isArray(filter.value)) {
      return `عملگر ${filter.operator} نیاز به آرایه دارد`;
    }
  } else {
    if (Array.isArray(filter.value)) {
      return `عملگر ${filter.operator} نمی‌تواند آرایه باشد`;
    }
  }

  return null;
}

/**
 * Validate date range
 */
function validateDateRange(dateRange: { start: string; end: string }): string | null {
  try {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    if (isNaN(start.getTime())) {
      return 'تاریخ شروع نامعتبر است';
    }
    if (isNaN(end.getTime())) {
      return 'تاریخ پایان نامعتبر است';
    }
    if (start > end) {
      return 'تاریخ شروع نباید بعد از تاریخ پایان باشد';
    }

    // Check for unreasonable date ranges (e.g., more than 10 years)
    const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (diffYears > 10) {
      return 'محدوده تاریخ بسیار بزرگ است (حداکثر ۱۰ سال)';
    }

    return null;
  } catch (error) {
    return 'خطا در اعتبارسنجی محدوده تاریخ';
  }
}

/**
 * Perform security checks on query plan
 */
function performSecurityChecks(query: AIQueryPlan): string[] {
  const errors: string[] = [];

  // Check for SQL injection attempts in filters
  if (query.filters) {
    for (const filter of query.filters) {
      const valueStr = JSON.stringify(filter.value);
      
      // Check for common SQL injection patterns
      if (valueStr.includes(';') || 
          valueStr.includes('--') || 
          valueStr.includes('/*') || 
          valueStr.includes('DROP') ||
          valueStr.includes('DELETE') ||
          valueStr.includes('UPDATE') ||
          valueStr.includes('INSERT')) {
        errors.push('الگوی نامعتبر در فیلتر شناسایی شد');
      }
    }
  }

  // Check for cross-user identifiers
  if (query.filters) {
    for (const filter of query.filters) {
      if (filter.field === 'account' || filter.field === 'phase') {
        // These should be validated against user ownership at execution time
        // For now, just ensure they're not empty strings or obviously invalid
        if (typeof filter.value === 'string' && filter.value.trim() === '') {
          errors.push('شناسه حساب/فاز نمی‌تواند خالی باشد');
        }
      }
    }
  }

  return errors;
}

/**
 * Check if a metric is allowed
 */
export function isAllowedMetric(metric: string): metric is AIMetric {
  return ALLOWED_METRICS.has(metric as AIMetric);
}

/**
 * Check if a dimension is allowed
 */
export function isAllowedDimension(dimension: string): dimension is AIDimension {
  return ALLOWED_DIMENSIONS.has(dimension as AIDimension);
}

/**
 * Get all allowed metrics
 */
export function getAllowedMetrics(): AIMetric[] {
  return Array.from(ALLOWED_METRICS);
}

/**
 * Get all allowed dimensions
 */
export function getAllowedDimensions(): AIDimension[] {
  return Array.from(ALLOWED_DIMENSIONS);
}
