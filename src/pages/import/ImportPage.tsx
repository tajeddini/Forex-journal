import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getAccounts } from '../../services/accounts';
import { getPhases } from '../../services/accountPhases';
import { createImportBatch, completeImportBatch } from '../../services/importBatches';
import { createTradesBatch, checkDuplicateTrades } from '../../services/trades';
import type { TradingAccount, AccountPhase, TradeSource, TradeInsert } from '../../types/database';
import { parseCSV, validateCSVFile, readFileAsText, detectDelimiter } from '../../utils/csv-parser';
import { mapColumns, normalizeTradeRow, detectTradeSource, type NormalizedTrade } from '../../utils/trade-normalizer';
import { findDuplicates } from '../../utils/duplicate-detector';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { getTrades } from '../../services/trades';

type ImportStep = 'select' | 'file' | 'mapping' | 'preview' | 'importing' | 'result';

interface ImportState {
  step: ImportStep;
  account: TradingAccount | null;
  phase: AccountPhase | null;
  file: File | null;
  rawContent: string;
  headers: string[];
  rows: Record<string, string>[];
  columnMapping: Record<string, string>;
  normalizedTrades: NormalizedTrade[];
  invalidRows: { row: number; field: string; message: string }[];
  duplicates: Map<number, any>;
  importResult: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    imported: number;
  } | null;
  source: TradeSource;
  delimiter: string;
}

export default function ImportPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [phases, setPhases] = useState<AccountPhase[]>([]);
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState<ImportState>({
    step: 'select',
    account: null,
    phase: null,
    file: null,
    rawContent: '',
    headers: [],
    rows: [],
    columnMapping: {},
    normalizedTrades: [],
    invalidRows: [],
    duplicates: new Map(),
    importResult: null,
    source: 'mt4',
    delimiter: ',',
  });

  // Load accounts
  useState(() => {
    if (user) {
      getAccounts(user.id)
        .then(setAccounts)
        .catch(() => toast.error('خطا در دریافت حساب‌ها'))
        .finally(() => setLoading(false));
    }
  });

  // Load phases when account changes
  const handleAccountChange = useCallback(async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account || !user) return;

    setState(prev => ({ ...prev, account, phase: null }));

    try {
      const phasesData = await getPhases(accountId, user.id);
      setPhases(phasesData);
    } catch {
      setPhases([]);
    }
  }, [accounts, user]);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'فایل نامعتبر است');
      return;
    }

    try {
      const content = await readFileAsText(file);
      const delimiter = detectDelimiter(content);
      const parsed = parseCSV(content, { delimiter });
      const mapping = mapColumns(parsed.headers);
      const source = detectTradeSource(file.name, parsed.headers);

      setState(prev => ({
        ...prev,
        step: 'mapping',
        file,
        rawContent: content,
        headers: parsed.headers,
        rows: parsed.rows,
        columnMapping: mapping,
        source,
        delimiter,
      }));
    } catch (err) {
      toast.error('خطا در خواندن فایل');
    }
  }, [toast]);

  // Normalize and validate
  const handleProceedToPreview = useCallback(() => {
    const normalizedTrades: NormalizedTrade[] = [];
    const invalidRows: { row: number; field: string; message: string }[] = [];

    // Step 1: Normalize all rows
    for (let i = 0; i < state.rows.length; i++) {
      const { trade, errors } = normalizeTradeRow(state.rows[i], state.columnMapping, i + 1);
      if (trade) {
        normalizedTrades.push(trade);
      } else {
        invalidRows.push(...errors);
      }
    }

    // Step 2: If MT5 source, apply aggregation
    let finalTrades = normalizedTrades;
    if (state.source === 'mt5' && normalizedTrades.length > 0) {
      try {
        // Import MT5 aggregation dynamically to avoid circular dependencies
        import('../../utils/mt5-aggregation').then(({ aggregateMT5Deals }) => {
          // Convert NormalizedTrade to MT5Deal format
          const mt5Deals = normalizedTrades.map(t => ({
            ticket: t.ticket || undefined,
            position_id: t.position_id || undefined,
            symbol: t.symbol,
            side: t.side,
            volume: t.volume,
            price: t.entry_price,
            datetime: t.entry_datetime,
            commission: t.commission || 0,
            swap: t.swap || 0,
            profit: t.profit || 0,
            type: 'deal' as const,
            comment: t.comment || undefined,
            magic_number: t.magic_number || undefined,
          }));

          const aggregated = aggregateMT5Deals(mt5Deals);
          
          // Convert back to NormalizedTrade format
          finalTrades = aggregated.map((pos: any) => ({
            ticket: pos.ticket,
            position_id: pos.position_id,
            symbol: pos.symbol,
            side: pos.side,
            volume: pos.total_volume,
            entry_datetime: pos.entry_datetime,
            entry_price: pos.weighted_entry_price,
            stop_loss: null,
            take_profit: null,
            exit_datetime: pos.exit_datetime,
            exit_price: pos.weighted_exit_price,
            commission: pos.total_commission,
            swap: pos.total_swap,
            profit: pos.total_profit,
            comment: pos.deals?.[0]?.comment || null,
            magic_number: pos.deals?.[0]?.magic_number || null,
          }));

          setState(prev => ({
            ...prev,
            step: 'preview',
            normalizedTrades: finalTrades,
            invalidRows,
          }));
        });
        return; // Early return, setState will be called in .then()
      } catch (err) {
        console.error('MT5 aggregation failed, using raw trades:', err);
        // Fall back to raw trades if aggregation fails
      }
    }

    setState(prev => ({
      ...prev,
      step: 'preview',
      normalizedTrades: finalTrades,
      invalidRows,
    }));
  }, [state.rows, state.columnMapping, state.source]);

  // Check duplicates
  const checkForDuplicates = useCallback(async () => {
    if (!state.account || !user) return;

    try {
      const existingTrades = await getTrades(user.id, state.account.id);
      const tickets = state.normalizedTrades
        .map(t => t.ticket)
        .filter((t): t is string => t !== null);
      
      const duplicateTickets = await checkDuplicateTrades(user.id, state.account.id, tickets);
      
      const duplicates = new Map<number, any>();
      state.normalizedTrades.forEach((trade, index) => {
        if (trade.ticket && duplicateTickets.has(trade.ticket)) {
          duplicates.set(index, { ticket: trade.ticket });
        }
      });

      setState(prev => ({ ...prev, duplicates }));
    } catch {
      // Continue without duplicate check
    }
  }, [state.account, state.normalizedTrades, user]);

  // Import trades
  const handleImport = useCallback(async () => {
    if (!state.account || !user || !state.file) return;

    setState(prev => ({ ...prev, step: 'importing' }));

    try {
      // Create import batch
      const batch = await createImportBatch({
        user_id: user.id,
        account_id: state.account.id,
        phase_id: state.phase?.id || null,
        source: state.source,
        file_name: state.file.name,
        file_size: state.file.size,
        total_rows: state.rows.length,
        valid_rows: state.normalizedTrades.length,
        invalid_rows: state.invalidRows.length,
        duplicate_rows: state.duplicates.size,
        imported_rows: 0,
        status: 'processing',
        parser_version: '1.0.0',
      });

      // Filter out duplicates
      const tradesToImport = state.normalizedTrades.filter((_, index) => !state.duplicates.has(index));

      // Prepare trade inserts
      const tradeInserts: TradeInsert[] = tradesToImport.map(trade => ({
        user_id: user.id,
        account_id: state.account!.id,
        phase_id: state.phase?.id || null,
        import_batch_id: batch.id,
        ticket: trade.ticket,
        position_id: trade.position_id,
        symbol: trade.symbol,
        side: trade.side,
        volume: trade.volume,
        entry_datetime: trade.entry_datetime,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        exit_datetime: trade.exit_datetime,
        exit_price: trade.exit_price,
        commission: trade.commission,
        swap: trade.swap,
        profit: trade.profit,
        comment: trade.comment,
        magic_number: trade.magic_number,
        source: state.source,
        source_file: state.file!.name,
      }));

      // Batch insert (chunks of 500)
      let importedCount = 0;
      const chunkSize = 500;
      
      for (let i = 0; i < tradeInserts.length; i += chunkSize) {
        const chunk = tradeInserts.slice(i, i + chunkSize);
        await createTradesBatch(chunk);
        importedCount += chunk.length;
      }

      // Complete batch
      const status = state.invalidRows.length > 0 || state.duplicates.size > 0
        ? 'completed_with_warnings'
        : 'completed';

      await completeImportBatch(batch.id, user.id, {
        total_rows: state.rows.length,
        valid_rows: state.normalizedTrades.length,
        invalid_rows: state.invalidRows.length,
        duplicate_rows: state.duplicates.size,
        imported_rows: importedCount,
        status,
      });

      setState(prev => ({
        ...prev,
        step: 'result',
        importResult: {
          total: state.rows.length,
          valid: state.normalizedTrades.length,
          invalid: state.invalidRows.length,
          duplicates: state.duplicates.size,
          imported: importedCount,
        },
      }));

      toast.success('معاملات با موفقیت وارد شدند');
    } catch (err) {
      toast.error('خطا در وارد کردن معاملات');
      setState(prev => ({ ...prev, step: 'preview' }));
    }
  }, [state, user, toast]);

  // Reset
  const handleReset = useCallback(() => {
    setState({
      step: 'select',
      account: null,
      phase: null,
      file: null,
      rawContent: '',
      headers: [],
      rows: [],
      columnMapping: {},
      normalizedTrades: [],
      invalidRows: [],
      duplicates: new Map(),
      importResult: null,
      source: 'mt4',
      delimiter: ',',
    });
  }, []);

  if (loading) {
    return <Loading message="در حال بارگذاری..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ورود معاملات</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          وارد کردن معاملات از MT4/MT5
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge step={1} label="انتخاب حساب" active={state.step === 'select'} completed={state.step !== 'select'} />
        <StepBadge step={2} label="فایل" active={state.step === 'file'} completed={['mapping', 'preview', 'importing', 'result'].includes(state.step)} />
        <StepBadge step={3} label="نگاشت" active={state.step === 'mapping'} completed={['preview', 'importing', 'result'].includes(state.step)} />
        <StepBadge step={4} label="پیش‌نمایش" active={state.step === 'preview'} completed={['importing', 'result'].includes(state.step)} />
        <StepBadge step={5} label="نتیجه" active={state.step === 'result'} completed={false} />
      </div>

      {/* Step 1: Select Account */}
      {state.step === 'select' && (
        <Card>
          <CardTitle>انتخاب حساب و فاز</CardTitle>
          <div className="space-y-4 mt-4">
            <Select
              label="حساب معاملاتی"
              value={state.account?.id || ''}
              onChange={(e) => handleAccountChange(e.target.value)}
              options={[
                { value: '', label: 'انتخاب حساب...' },
                ...accounts.map(a => ({ value: a.id, label: a.name })),
              ]}
            />

            {phases.length > 0 && (
              <Select
                label="فاز (اختیاری)"
                value={state.phase?.id || ''}
                onChange={(e) => {
                  const phase = phases.find(p => p.id === e.target.value);
                  setState(prev => ({ ...prev, phase: phase || null }));
                }}
                options={[
                  { value: '', label: 'بدون فاز' },
                  ...phases.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            )}

            <Button
              onClick={() => setState(prev => ({ ...prev, step: 'file' }))}
              disabled={!state.account}
            >
              ادامه
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: File Selection */}
      {state.step === 'file' && (
        <Card>
          <CardTitle>انتخاب فایل CSV</CardTitle>
          <div className="mt-4">
            <FileDropzone onFileSelect={handleFileSelect} />
          </div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setState(prev => ({ ...prev, step: 'select' }))}>
              بازگشت
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Column Mapping */}
      {state.step === 'mapping' && (
        <Card>
          <CardTitle>نگاشت ستون‌ها</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            ستون‌های فایل CSV به فیلدهای معامله نگاشت شدند. در صورت نیاز اصلاح کنید.
          </p>
          <div className="mt-4 space-y-2">
            {state.headers.map(header => (
              <div key={header} className="flex items-center gap-4 text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300 w-48">{header}</span>
                <span className="text-gray-400">→</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {state.columnMapping[header] || '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setState(prev => ({ ...prev, step: 'file' }))}>
              بازگشت
            </Button>
            <Button onClick={handleProceedToPreview}>
              ادامه به پیش‌نمایش
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Preview */}
      {state.step === 'preview' && (
        <Card>
          <CardTitle>پیش‌نمایش معاملات</CardTitle>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="کل ردیف‌ها" value={state.rows.length} />
            <StatBox label="معتبر" value={state.normalizedTrades.length} color="green" />
            <StatBox label="نامعتبر" value={state.invalidRows.length} color="red" />
            <StatBox label="تکراری" value={state.duplicates.size} color="yellow" />
          </div>

          {state.invalidRows.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">ردیف‌های نامعتبر:</p>
              {state.invalidRows.slice(0, 5).map((err, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">
                  ردیف {err.row}: {err.message}
                </p>
              ))}
              {state.invalidRows.length > 5 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  و {state.invalidRows.length - 5} مورد دیگر...
                </p>
              )}
            </div>
          )}

          {/* Preview Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-right">نماد</th>
                  <th className="px-3 py-2 text-right">نوع</th>
                  <th className="px-3 py-2 text-right">حجم</th>
                  <th className="px-3 py-2 text-right">قیمت ورود</th>
                  <th className="px-3 py-2 text-right">قیمت خروج</th>
                  <th className="px-3 py-2 text-right">سود</th>
                </tr>
              </thead>
              <tbody>
                {state.normalizedTrades.slice(0, 10).map((trade, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="px-3 py-2">{trade.symbol}</td>
                    <td className="px-3 py-2">
                      <Badge variant={trade.side === 'buy' ? 'success' : 'danger'}>
                        {trade.side === 'buy' ? 'خرید' : 'فروش'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2" dir="ltr">{trade.volume}</td>
                    <td className="px-3 py-2" dir="ltr">{trade.entry_price}</td>
                    <td className="px-3 py-2" dir="ltr">{trade.exit_price}</td>
                    <td className="px-3 py-2" dir="ltr">{trade.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.normalizedTrades.length > 10 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                نمایش ۱۰ مورد از {state.normalizedTrades.length} معامله
              </p>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setState(prev => ({ ...prev, step: 'mapping' }))}>
              بازگشت
            </Button>
            <Button onClick={handleImport} disabled={state.normalizedTrades.length === 0}>
              ورود {state.normalizedTrades.length - state.duplicates.size} معامله
            </Button>
          </div>
        </Card>
      )}

      {/* Step 5: Importing */}
      {state.step === 'importing' && (
        <Card>
          <Loading message="در حال ورود معاملات..." />
        </Card>
      )}

      {/* Step 6: Result */}
      {state.step === 'result' && state.importResult && (
        <Card>
          <CardTitle>نتیجه ورود</CardTitle>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox label="کل ردیف‌ها" value={state.importResult.total} />
            <StatBox label="معتبر" value={state.importResult.valid} color="green" />
            <StatBox label="واردشده" value={state.importResult.imported} color="blue" />
            <StatBox label="تکراری" value={state.importResult.duplicates} color="yellow" />
            <StatBox label="نامعتبر" value={state.importResult.invalid} color="red" />
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={handleReset}>ورود مجدد</Button>
            <Button variant="secondary" onClick={() => window.location.href = '/app/accounts'}>
              بازگشت به حساب‌ها
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// Helper components
function StepBadge({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
      active ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
      completed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
    }`}>
      <span>{step}</span>
      <span>{label}</span>
    </div>
  );
}

function StatBox({ label, value, color = 'blue' }: { label: string; value: number; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800/30',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function FileDropzone({ onFileSelect }: { onFileSelect: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center transition-colors
        ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
      `}
    >
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        فایل CSV را اینجا رها کنید یا
      </p>
      <label className="mt-2 cursor-pointer">
        <span className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500">
          انتخاب فایل
        </span>
        <input type="file" accept=".csv" onChange={handleChange} className="hidden" />
      </label>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
        حداکثر ۱۰ مگابایت
      </p>
    </div>
  );
}
