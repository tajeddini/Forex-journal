import type { ParsedCSV } from './csv-parser';

const SHEETJS_URL =
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

export interface ParsedMT5Report extends ParsedCSV {
  format: 'mt5-position-report';
}

/**
 * Parse the XLSX "Positions" report exported by MetaTrader 5.
 *
 * The MT5 report contains account metadata before the Positions table and
 * a Results section after it. We intentionally extract only the position
 * rows and ignore summary rows.
 */
export async function parseMT5PositionReport(file: File): Promise<ParsedMT5Report> {
  const XLSX = await import(/* @vite-ignore */ SHEETJS_URL);
  const workbook = XLSX.read(await file.arrayBuffer(), {
    cellDates: false,
    dense: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('فایل Excel فاقد برگه است');
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  const normalize = (value: unknown) =>
    String(value ?? '').trim().toLowerCase().replace(/\\s+/g, ' ');

  const headerIndex = matrix.findIndex((row) => {
    const cells = row.map(normalize);
    return (
      cells.includes('time') &&
      cells.includes('position') &&
      cells.includes('symbol') &&
      cells.includes('type') &&
      cells.includes('volume') &&
      cells.includes('profit')
    );
  });

  if (headerIndex < 0) {
    throw new Error(
      'ساختار فایل متاتریدر شناسایی نشد. فایل باید گزارش Positions متاتریدر 5 باشد.'
    );
  }

  const header = matrix[headerIndex] || [];
  const findColumn = (label: string, from = 0) =>
    header.findIndex((value, index) => index >= from && normalize(value) === label);

  const entryTimeIndex = findColumn('time');
  const positionIndex = findColumn('position');
  const symbolIndex = findColumn('symbol');
  const typeIndex = findColumn('type');
  const volumeIndex = findColumn('volume');
  const entryPriceIndex = findColumn('price');
  const slIndex = findColumn('s / l');
  const tpIndex = findColumn('t / p');
  const exitTimeIndex = findColumn('time', entryTimeIndex + 1);
  const exitPriceIndex = findColumn('price', entryPriceIndex + 1);
  const commissionIndex = findColumn('commission');
  const swapIndex = findColumn('swap');
  const profitIndex = findColumn('profit');

  const requiredIndexes = [
    entryTimeIndex,
    positionIndex,
    symbolIndex,
    typeIndex,
    volumeIndex,
    entryPriceIndex,
    exitTimeIndex,
    exitPriceIndex,
    commissionIndex,
    swapIndex,
    profitIndex,
  ];

  if (requiredIndexes.some((index) => index < 0)) {
    throw new Error(
      'ستون‌های ضروری گزارش MT5 کامل نیستند. ستون‌های Time, Position, Symbol, Type, Volume, Price و Profit باید وجود داشته باشند.'
    );
  }

  const headers = [
    'entry_datetime',
    'position_id',
    'symbol',
    'side',
    'volume',
    'entry_price',
    'stop_loss',
    'take_profit',
    'exit_datetime',
    'exit_price',
    'commission',
    'swap',
    'profit',
  ];

  const rows: Record<string, string>[] = [];

  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const firstCell = normalize(row[0]);

    // MT5 report summary starts at "Results"; everything after it is ignored.
    if (firstCell === 'results') break;
    if (!row.some((value) => String(value ?? '').trim() !== '')) continue;

    const valueAt = (index: number) => {
      const value = row[index];
      return value === null || value === undefined ? '' : String(value);
    };

    // Ignore non-position rows that may appear between the header and Results.
    const symbol = valueAt(symbolIndex).trim();
    const position = valueAt(positionIndex).trim();
    if (!symbol || !position) continue;

    rows.push({
      entry_datetime: valueAt(entryTimeIndex),
      position_id: position,
      symbol,
      side: valueAt(typeIndex),
      volume: valueAt(volumeIndex),
      entry_price: valueAt(entryPriceIndex),
      stop_loss: slIndex >= 0 ? valueAt(slIndex) : '',
      take_profit: tpIndex >= 0 ? valueAt(tpIndex) : '',
      exit_datetime: valueAt(exitTimeIndex),
      exit_price: valueAt(exitPriceIndex),
      commission: valueAt(commissionIndex),
      swap: valueAt(swapIndex),
      profit: valueAt(profitIndex),
    });
  }

  if (rows.length === 0) {
    throw new Error('در بخش Positions هیچ معامله‌ای پیدا نشد.');
  }

  return {
    headers,
    rows,
    delimiter: '',
    totalRows: rows.length,
    format: 'mt5-position-report',
  };
}
