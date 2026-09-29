import type { TradeSide, TradeSource } from '../types/database';

// ============================================================
// Trade Data Normalizer
// ============================================================

export interface NormalizedTrade {
  ticket: string | null;
  position_id: string | null;
  symbol: string;
  side: TradeSide;
  volume: number;
  entry_datetime: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  exit_datetime: string;
  exit_price: number;
  commission: number;
  swap: number;
  profit: number;
  comment: string | null;
  magic_number: number | null;
}

export interface NormalizationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

// Column mapping aliases
const COLUMN_ALIASES: Record<string, string[]> = {
  ticket: ['ticket', 'order', 'ticket number', 'order number'],
  position_id: ['position', 'position id', 'deal', 'deal number'],
  symbol: ['symbol', 'instrument', 'pair', 'security'],
  side: ['type', 'side', 'direction', 'order type', 'deal type'],
  volume: ['volume', 'lots', 'size', 'quantity'],
  entry_datetime: ['open time', 'open time1', 'entry time', 'open date', 'opened'],
  entry_price: ['price', 'open price', 'entry price'],
  stop_loss: ['stop loss', 'sl', 's/l', 'stoploss'],
  take_profit: ['take profit', 'tp', 't/p', 'takeprofit'],
  exit_datetime: ['close time', 'close time1', 'exit time', 'close date', 'closed'],
  exit_price: ['close price', 'exit price'],
  commission: ['commission'],
  swap: ['swap'],
  profit: ['profit', 'p/l', 'net profit', 'gross profit'],
  comment: ['comment', 'comments'],
  magic_number: ['magic', 'magic number', 'magicnumber'],
};

/**
 * Map CSV headers to normalized field names
 */
export function mapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();
    
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some(alias => normalizedHeader === alias || normalizedHeader.includes(alias))) {
        mapping[header] = field;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Normalize trade side
 */
export function normalizeSide(value: string): TradeSide | null {
  const normalized = value.toLowerCase().trim();
  
  if (['buy', 'long', 'buy in'].includes(normalized)) {
    return 'buy';
  }
  if (['sell', 'short', 'sell out'].includes(normalized)) {
    return 'sell';
  }
  
  return null;
}

/**
 * Normalize numeric value
 */
export function normalizeNumber(value: string): number | null {
  if (!value || value.trim() === '' || value === '-') {
    return null;
  }

  // Remove thousands separator and handle decimal
  let cleaned = value.trim();
  
  // Handle European format (1.234,56 -> 1234.56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // European format
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be decimal separator
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Normalize datetime
 */
export function normalizeDatetime(value: string): string | null {
  if (!value || value.trim() === '') {
    return null;
  }

  let cleaned = value.trim();

  // Handle MT4/MT5 formats
  // 2024.01.15 14:30:00
  cleaned = cleaned.replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');
  
  // Try to parse
  const date = new Date(cleaned);
  
  if (isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/**
 * Normalize a single trade row
 */
export function normalizeTradeRow(
  row: Record<string, string>,
  columnMapping: Record<string, string>,
  rowNumber: number
): { trade: NormalizedTrade | null; errors: NormalizationError[] } {
  const errors: NormalizationError[] = [];
  
  // Map columns
  const mapped: Record<string, string> = {};
  for (const [csvCol, normalizedField] of Object.entries(columnMapping)) {
    if (row[csvCol] !== undefined) {
      mapped[normalizedField] = row[csvCol];
    }
  }

  // Required fields
  const symbol = mapped.symbol?.trim();
  if (!symbol) {
    errors.push({ row: rowNumber, field: 'symbol', message: 'نماد الزامی است' });
  }

  const side = normalizeSide(mapped.side || '');
  if (!side) {
    errors.push({ row: rowNumber, field: 'side', message: 'نوع معامله قابل تشخیص نیست', value: mapped.side });
  }

  const volume = normalizeNumber(mapped.volume || '');
  if (volume === null || volume <= 0) {
    errors.push({ row: rowNumber, field: 'volume', message: 'حجم معتبر نیست', value: mapped.volume });
  }

  const entryDatetime = normalizeDatetime(mapped.entry_datetime || '');
  if (!entryDatetime) {
    errors.push({ row: rowNumber, field: 'entry_datetime', message: 'زمان ورود معتبر نیست', value: mapped.entry_datetime });
  }

  const entryPrice = normalizeNumber(mapped.entry_price || '');
  if (entryPrice === null) {
    errors.push({ row: rowNumber, field: 'entry_price', message: 'قیمت ورود معتبر نیست', value: mapped.entry_price });
  }

  const exitDatetime = normalizeDatetime(mapped.exit_datetime || '');
  if (!exitDatetime) {
    errors.push({ row: rowNumber, field: 'exit_datetime', message: 'زمان خروج معتبر نیست', value: mapped.exit_datetime });
  }

  const exitPrice = normalizeNumber(mapped.exit_price || '');
  if (exitPrice === null) {
    errors.push({ row: rowNumber, field: 'exit_price', message: 'قیمت خروج معتبر نیست', value: mapped.exit_price });
  }

  const profit = normalizeNumber(mapped.profit || '');
  if (profit === null) {
    errors.push({ row: rowNumber, field: 'profit', message: 'سود/زیان معتبر نیست', value: mapped.profit });
  }

  // If there are errors, return null
  if (errors.length > 0) {
    return { trade: null, errors };
  }

  // Optional fields
  const stopLoss = normalizeNumber(mapped.stop_loss || '');
  const takeProfit = normalizeNumber(mapped.take_profit || '');
  const commission = normalizeNumber(mapped.commission || '') || 0;
  const swap = normalizeNumber(mapped.swap || '') || 0;

  // Validate exit after entry
  if (entryDatetime && exitDatetime) {
    if (new Date(exitDatetime) < new Date(entryDatetime)) {
      errors.push({ row: rowNumber, field: 'exit_datetime', message: 'زمان خروج قبل از زمان ورود است' });
      return { trade: null, errors };
    }
  }

  const trade: NormalizedTrade = {
    ticket: mapped.ticket || null,
    position_id: mapped.position_id || null,
    symbol: symbol!,
    side: side!,
    volume: volume!,
    entry_datetime: entryDatetime!,
    entry_price: entryPrice!,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    exit_datetime: exitDatetime!,
    exit_price: exitPrice!,
    commission,
    swap,
    profit: profit!,
    comment: mapped.comment || null,
    magic_number: normalizeNumber(mapped.magic_number || ''),
  };

  return { trade, errors: [] };
}

/**
 * Detect trade source from filename or content
 */
export function detectTradeSource(filename: string, headers: string[]): TradeSource {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('mt5') || lowerFilename.includes('metatrader5')) {
    return 'mt5';
  }
  if (lowerFilename.includes('mt4') || lowerFilename.includes('metatrader4')) {
    return 'mt4';
  }

  // Check headers for MT5-specific fields
  const headerStr = headers.join(' ').toLowerCase();
  if (headerStr.includes('deal') || headerStr.includes('position')) {
    return 'mt5';
  }

  // Default to MT4
  return 'mt4';
}
