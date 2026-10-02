import type { TradeSide, TradeSource } from '../types/database';
import type { MT5Deal } from './mt5-aggregation';

// ============================================================
// Trade Data Normalizer
// Supports MT4 closed trades & MT5 deal-level records
// ============================================================

export interface NormalizedTrade {
  ticket: string | null;
  position_id: string | null;
  position_by_id?: string | null;
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

// Column mapping aliases for closed trade exports (MT4 & general CSV)
const COLUMN_ALIASES: Record<string, string[]> = {
  ticket: ['ticket', 'order', 'ticket number', 'order number'],
  position_id: ['position', 'position id', 'deal', 'deal number'],
  symbol: ['symbol', 'instrument', 'pair', 'security', 'item'],
  side: ['type', 'side', 'direction', 'order type', 'deal type'],
  volume: ['volume', 'lots', 'size', 'quantity'],
  entry_datetime: ['open time', 'open time1', 'entry time', 'open date', 'opened'],
  entry_price: ['open price', 'entry price', 'price'],
  stop_loss: ['stop loss', 'sl', 's/l', 'stoploss'],
  take_profit: ['take profit', 'tp', 't/p', 'takeprofit'],
  exit_datetime: ['close time', 'close time1', 'exit time', 'close date', 'closed'],
  exit_price: ['close price', 'exit price'],
  commission: ['commission', 'comm'],
  swap: ['swap', 'rollover'],
  profit: ['profit', 'p/l', 'net profit', 'gross profit'],
  comment: ['comment', 'comments'],
  magic_number: ['magic', 'magic number', 'magicnumber'],
};

/**
 * Detect trade source from CSV filename and/or headers
 */
export function detectTradeSource(
  fileOrHeaders: string | string[],
  headersParam?: string[]
): TradeSource {
  let filename = '';
  let headers: string[] = [];

  if (typeof fileOrHeaders === 'string') {
    filename = fileOrHeaders.toLowerCase();
    headers = headersParam || [];
  } else if (Array.isArray(fileOrHeaders)) {
    headers = fileOrHeaders;
    filename = typeof headersParam === 'string' ? (headersParam as string).toLowerCase() : '';
  }

  const normalized = headers.map(h => h.toLowerCase().trim());

  if (filename.includes('mt5') || filename.includes('metatrader5')) {
    return 'mt5';
  }
  if (filename.includes('mt4') || filename.includes('metatrader4')) {
    return 'mt4';
  }

  // MT5 checks: has deal or position or entry/direction columns
  const hasDeal = normalized.some(h => h === 'deal' || h.includes('deal'));
  const hasPosition = normalized.some(h => h === 'position' || h.includes('position'));
  const hasEntryDirection = normalized.some(h => h === 'entry' || h === 'direction');
  const hasMT4OpenAndClose = normalized.some(h => h.includes('open time')) && normalized.some(h => h.includes('close time'));

  if ((hasDeal || hasPosition || hasEntryDirection) && !hasMT4OpenAndClose) {
    return 'mt5';
  }

  if (hasMT4OpenAndClose) {
    return 'mt4';
  }

  return 'mt4';
}

/**
 * Map CSV headers to normalized field names
 */
export function mapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();
    
    // First: exact match against any alias
    let matchedField: string | null = null;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some(alias => normalizedHeader === alias)) {
        matchedField = field;
        break;
      }
    }

    // Second: if no exact match, find the longest matching substring alias
    if (!matchedField) {
      let longestMatchLength = 0;
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
          if (normalizedHeader.includes(alias) && alias.length > longestMatchLength) {
            longestMatchLength = alias.length;
            matchedField = field;
          }
        }
      }
    }

    if (matchedField) {
      mapping[header] = matchedField;
    }
  }

  return mapping;
}

/**
 * Normalize trade side
 */
export function normalizeSide(value: string): TradeSide | null {
  const normalized = value.toLowerCase().trim();
  
  if (['buy', 'long', 'buy in', 'buy limit', 'buy stop'].includes(normalized)) {
    return 'buy';
  }
  if (['sell', 'short', 'sell out', 'sell limit', 'sell stop'].includes(normalized)) {
    return 'sell';
  }
  
  return null;
}

/**
 * Normalize numeric value
 */
export function normalizeNumber(value: string | number): number | null {
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (!value || value.trim() === '' || value === '-') {
    return null;
  }

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

  // Handle MT4/MT5 formats: 2024.01.15 14:30:00 -> 2024-01-15 14:30:00
  cleaned = cleaned.replace(/(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3');
  
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/**
 * Parse a raw row from MT5 Deals export into an MT5Deal
 */
export function parseMT5DealRow(
  row: Record<string, string>,
  rowNumber: number
): { deal: MT5Deal | null; errors: NormalizationError[] } {
  const errors: NormalizationError[] = [];

  // Find fields by loose case-insensitive matching
  const findVal = (keywords: string[]): string => {
    for (const [key, val] of Object.entries(row)) {
      const lower = key.toLowerCase().trim();
      if (keywords.some(k => lower === k || lower.includes(k))) {
        return val || '';
      }
    }
    return '';
  };

  const symbol = findVal(['symbol', 'item']);
  if (!symbol) {
    errors.push({ row: rowNumber, field: 'symbol', message: 'نماد الزامی است' });
  }

  const typeVal = findVal(['type', 'side']);
  const side = normalizeSide(typeVal);
  if (!side) {
    errors.push({ row: rowNumber, field: 'type', message: 'نوع معامله نامعتبر است', value: typeVal });
  }

  const volumeVal = findVal(['volume', 'size', 'lots']);
  const volume = normalizeNumber(volumeVal);
  if (volume === null || volume <= 0) {
    errors.push({ row: rowNumber, field: 'volume', message: 'حجم نامعتبر است', value: volumeVal });
  }

  const priceVal = findVal(['price', 'deal price']);
  const price = normalizeNumber(priceVal);
  if (price === null || price < 0) {
    errors.push({ row: rowNumber, field: 'price', message: 'قیمت نامعتبر است', value: priceVal });
  }

  const timeVal = findVal(['time', 'date', 'datetime']);
  const datetime = normalizeDatetime(timeVal);
  if (!datetime) {
    errors.push({ row: rowNumber, field: 'time', message: 'زمان نامعتبر است', value: timeVal });
  }

  if (errors.length > 0) {
    return { deal: null, errors };
  }

  const dealId = findVal(['deal', 'ticket']) || undefined;
  const orderId = findVal(['order']) || undefined;
  const positionId = findVal(['position', 'position id']) || orderId || dealId;
  const rawEntry = findVal(['entry', 'direction']);
  let validatedEntry: 'in' | 'out' | 'inout' | 'out_by' | undefined = undefined;

  if (rawEntry) {
    const lower = rawEntry.toLowerCase().trim();
    if (lower === 'in' || lower === 'entry' || lower === 'deal_entry_in') {
      validatedEntry = 'in';
    } else if (lower === 'out' || lower === 'exit' || lower === 'deal_entry_out') {
      validatedEntry = 'out';
    } else if (lower === 'inout' || lower === 'in/out' || lower === 'deal_entry_inout') {
      validatedEntry = 'inout';
    } else if (
      lower === 'out_by' ||
      lower === 'out by' ||
      lower === 'outby' ||
      lower === 'deal_entry_out_by' ||
      lower === 'close by'
    ) {
      validatedEntry = 'out_by';
    } else {
      errors.push({
        row: rowNumber,
        field: 'entry',
        message: `نوع ورود/خروج ناشناخته است: ${rawEntry}`,
        value: rawEntry,
      });
      return { deal: null, errors };
    }
  }

  // Authoritative opposite position ID for Close By (out_by)
  const positionById = findVal([
    'position by',
    'position_by',
    'positionby',
    'position_by_id',
    'position by id',
    'opposite position',
    'opposite_position',
    'close by position',
    'close_by_position',
    'opposite position id',
  ]) || undefined;

  // Strict validation: OUT_BY deal must have an authoritative opposite position ID from structured columns
  if (validatedEntry === 'out_by' && !positionById) {
    errors.push({
      row: rowNumber,
      field: 'position_by_id',
      message: 'معامله خروج Close By (out_by) فاقد ستون ساختاریافته شناسه پوزیشن مقابل (Position By) است. فرمت بدون ستون شناسه پوزیشن مقابل جهت جلوگیری از حدس اشتباه پشتیبانی نمی‌شود.',
    });
    return { deal: null, errors };
  }

  const commission = normalizeNumber(findVal(['commission'])) || 0;
  const swap = normalizeNumber(findVal(['swap'])) || 0;
  const profit = normalizeNumber(findVal(['profit'])) || 0;
  const comment = findVal(['comment']) || undefined;
  const magicRaw = normalizeNumber(findVal(['magic']));

  const deal: MT5Deal = {
    ticket: dealId,
    position_id: positionId,
    position_by_id: positionById?.trim() || undefined,
    order_id: orderId,
    deal_id: dealId,
    symbol: symbol.trim(),
    side: side!,
    volume: volume!,
    price: price!,
    datetime: datetime!,
    commission,
    swap,
    profit,
    type: validatedEntry || (profit !== 0 ? 'out' : 'in'),
    entry: validatedEntry,
    comment: comment?.trim() || undefined,
    magic_number: magicRaw !== null ? magicRaw : undefined,
  };

  return { deal, errors: [] };
}

/**
 * Normalize a single closed trade row (MT4 & general CSV format)
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
