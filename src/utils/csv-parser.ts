import Papa from 'papaparse';

// ============================================================
// CSV Parser for MT4/MT5 Import
// ============================================================

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  totalRows: number;
}

export interface ParseOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
}

/**
 * Parse CSV file content
 */
export function parseCSV(content: string, options: ParseOptions = {}): ParsedCSV {
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '');

  const result = Papa.parse(cleanContent, {
    header: true,
    skipEmptyLines: options.skipEmptyLines ?? true,
    delimiter: options.delimiter || '',
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  return {
    headers: result.meta.fields || [],
    rows: result.data as Record<string, string>[],
    delimiter: result.meta.delimiter || ',',
    totalRows: result.data.length,
  };
}

/**
 * Detect delimiter from CSV content
 */
export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0];
  
  const delimiters = [',', ';', '\t'];
  let maxCount = 0;
  let bestDelimiter = ',';

  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(delimiter === '\t' ? '\\t' : delimiter, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

/**
 * Validate CSV file
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // Check extension
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'فقط فایل‌های CSV پشتیبانی می‌شوند' };
  }

  // Check size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'حجم فایل نباید بیشتر از ۱۰ مگابایت باشد' };
  }

  // Check if empty
  if (file.size === 0) {
    return { valid: false, error: 'فایل خالی است' };
  }

  return { valid: true };
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsText(file, 'UTF-8');
  });
}
