import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getTradeWithJournal, upsertTradeJournal } from '../../services/tradeJournals';
import { getStrategies } from '../../services/strategies';
import { getSetups } from '../../services/setups';
import { getTags, setTradeTags } from '../../services/tags';
import { getMistakes, setTradeMistakes } from '../../services/mistakes';
import { getTradeImages, deleteTradeImage } from '../../services/tradeImages';
import type { TradeWithJournal, TradeImage, Strategy, Setup, Tag, Mistake, TradeJournalUpdate, RuleAdherence, JournalStatus } from '../../types/database';
import { RULE_ADHERENCE_OPTIONS, EMOTIONS, DEFAULT_CHECKLIST } from '../../types/database';
import { Card, CardTitle, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatCurrency, formatDateTime, formatDuration, getJournalStatusLabel, getRuleAdherenceLabel } from '../../utils/format';
import { VoiceInput } from '../../components/journal/VoiceInput';
import { TradeImageUpload } from '../../components/trades/TradeImageUpload';
import { TradeImageViewer } from '../../components/trades/TradeImageViewer';

type Tab = 'info' | 'pretrade' | 'psychology' | 'review' | 'screenshots';

export default function TradeDetailPage() {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [trade, setTrade] = useState<TradeWithJournal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [saving, setSaving] = useState(false);

  // Reference data
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);

  // Journal form state
  const [journalData, setJournalData] = useState<TradeJournalUpdate>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMistakes, setSelectedMistakes] = useState<{ id: string; notes?: string }[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Screenshots state
  const [images, setImages] = useState<TradeImage[]>([]);

  const fetchTrade = useCallback(async () => {
    if (!user || !tradeId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getTradeWithJournal(tradeId, user.id);
      if (!data) {
        setError('معامله یافت نشد یا دسترسی غیرمجاز است');
        return;
      }
      setTrade(data);

      // Initialize journal data
      if (data.journal) {
        setJournalData({
          strategy_id: data.journal.strategy_id,
          setup_id: data.journal.setup_id,
          market_context: data.journal.market_context,
          market_bias: data.journal.market_bias,
          timeframe: data.journal.timeframe,
          important_levels: data.journal.important_levels,
          confluences: data.journal.confluences,
          entry_reason: data.journal.entry_reason,
          expected_scenario: data.journal.expected_scenario,
          invalidating_condition: data.journal.invalidating_condition,
          planned_risk_amount: data.journal.planned_risk_amount,
          planned_risk_percentage: data.journal.planned_risk_percentage,
          planned_rr: data.journal.planned_rr,
          confidence: data.journal.confidence,
          checklist: data.journal.checklist,
          emotion_before: data.journal.emotion_before,
          emotion_during: data.journal.emotion_during,
          emotion_after: data.journal.emotion_after,
          execution_quality: data.journal.execution_quality,
          rule_adherence: data.journal.rule_adherence,
          rule_adherence_notes: data.journal.rule_adherence_notes,
          what_went_well: data.journal.what_went_well,
          what_went_wrong: data.journal.what_went_wrong,
          lesson_learned: data.journal.lesson_learned,
          post_trade_notes: data.journal.post_trade_notes,
          status: data.journal.status,
        });
        setChecklist(data.journal.checklist || {});
      }

      setSelectedTags(data.tags?.map(t => t.id) || []);
      setSelectedMistakes(data.mistakes?.map(m => ({ id: m.mistake.id, notes: m.notes || undefined })) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در دریافت معامله');
    } finally {
      setLoading(false);
    }
  }, [user, tradeId]);

  const fetchReferenceData = useCallback(async () => {
    if (!user) return;
    try {
      const [strats, setps, tgs, msts] = await Promise.all([
        getStrategies(user.id),
        getSetups(user.id),
        getTags(user.id),
        getMistakes(user.id),
      ]);
      setStrategies(strats);
      setSetups(setps);
      setTags(tgs);
      setMistakes(msts);
    } catch {
      // Non-critical, continue
    }
  }, [user]);

  const fetchImages = useCallback(async () => {
    if (!tradeId) return;
    try {
      const imgs = await getTradeImages(tradeId);
      setImages(imgs);
    } catch {
      setImages([]);
    }
  }, [tradeId]);

  useEffect(() => {
    fetchTrade();
    fetchReferenceData();
    fetchImages();
  }, [fetchTrade, fetchReferenceData, fetchImages]);

  const handleSaveJournal = async () => {
    if (!user || !trade) return;

    try {
      setSaving(true);
      
      // Determine journal status
      let status: JournalStatus = 'not_started';
      const hasAnyData = Object.values(journalData).some(v => v !== null && v !== undefined && v !== '' && v !== 'not_set');
      const hasCoreData = journalData.entry_reason || journalData.strategy_id || journalData.rule_adherence !== 'not_set';
      
      if (hasCoreData) {
        status = 'completed';
      } else if (hasAnyData) {
        status = 'in_progress';
      }

      const updatedJournal = await upsertTradeJournal(trade.id, user.id, {
        ...journalData,
        checklist,
        status,
      });

      // Save tags
      await setTradeTags(trade.id, selectedTags);

      // Save mistakes
      await setTradeMistakes(trade.id, selectedMistakes);

      toast.success('ژورنال با موفقیت ذخیره شد');
      
      // Refresh trade data
      await fetchTrade();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ذخیره ژورنال');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setJournalData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (image: TradeImage) => {
    setImages(prev => [...prev, image]);
  };

  const handleImageDelete = async (imageId: string) => {
    if (!user) return;
    try {
      await deleteTradeImage(imageId, user.id);
      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('تصویر با موفقیت حذف شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در حذف تصویر');
    }
  };

  if (loading) return <Loading message="در حال بارگذاری..." />;
  if (error || !trade) return <ErrorState message={error || 'معامله یافت نشد'} retry={() => navigate('/app/trades')} />;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/app/trades" className="hover:text-blue-600 dark:hover:text-blue-400">معاملات</Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-gray-100">{trade.symbol} — {trade.ticket || trade.id.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{trade.symbol}</h1>
            <Badge variant={trade.side === 'buy' ? 'success' : 'danger'}>
              {trade.side === 'buy' ? 'خرید' : 'فروش'}
            </Badge>
            <Badge variant={trade.profit >= 0 ? 'success' : 'danger'}>
              {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatDateTime(trade.entry_datetime)} • حجم: {trade.volume}
          </p>
        </div>
        <Button onClick={handleSaveJournal} loading={saving}>
          ذخیره ژورنال
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>اطلاعات معامله</TabButton>
        <TabButton active={activeTab === 'pretrade'} onClick={() => setActiveTab('pretrade')}>برنامه قبل از معامله</TabButton>
        <TabButton active={activeTab === 'psychology'} onClick={() => setActiveTab('psychology')}>روانشناسی</TabButton>
        <TabButton active={activeTab === 'review'} onClick={() => setActiveTab('review')}>بازبینی</TabButton>
        <TabButton active={activeTab === 'screenshots'} onClick={() => setActiveTab('screenshots')}>
          اسکرین‌شات‌ها {images.length > 0 && `(${images.length})`}
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Broker Data */}
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات بروکر</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem label="تیکت" value={trade.ticket || '—'} />
              <InfoItem label="Position ID" value={trade.position_id || '—'} />
              <InfoItem label="نماد" value={trade.symbol} />
              <InfoItem label="جهت" value={trade.side === 'buy' ? 'خرید' : 'فروش'} />
              <InfoItem label="حجم" value={String(trade.volume)} />
              <InfoItem label="قیمت ورود" value={String(trade.entry_price)} />
              <InfoItem label="حد ضرر" value={trade.stop_loss ? String(trade.stop_loss) : '—'} />
              <InfoItem label="حد سود" value={trade.take_profit ? String(trade.take_profit) : '—'} />
              <InfoItem label="قیمت خروج" value={String(trade.exit_price)} />
              <InfoItem label="زمان ورود" value={formatDateTime(trade.entry_datetime)} />
              <InfoItem label="زمان خروج" value={formatDateTime(trade.exit_datetime)} />
              <InfoItem label="مدت" value={formatDuration(trade.duration_seconds)} />
              <InfoItem label="کمیسیون" value={trade.commission.toFixed(2)} />
              <InfoItem label="سواپ" value={trade.swap.toFixed(2)} />
              <InfoItem label="سود" value={trade.profit.toFixed(2)} />
              <InfoItem label="منبع" value={trade.source.toUpperCase()} />
            </div>
            {trade.comment && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">کامنت بروکر</p>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{trade.comment}</p>
              </div>
            )}
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>تگ‌ها</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag.id)
                        ? prev.filter(id => id !== tag.id)
                        : [...prev, tag.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">تگی تعریف نشده. از تنظیمات تگ اضافه کنید.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'pretrade' && (
        <div className="space-y-6">
          {/* Strategy & Setup */}
          <Card>
            <CardHeader>
              <CardTitle>استراتژی و ستاپ</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="استراتژی"
                value={journalData.strategy_id || ''}
                onChange={(e) => updateField('strategy_id', e.target.value || null)}
                options={[
                  { value: '', label: 'انتخاب نشده' },
                  ...strategies.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
              <Select
                label="ستاپ"
                value={journalData.setup_id || ''}
                onChange={(e) => updateField('setup_id', e.target.value || null)}
                options={[
                  { value: '', label: 'انتخاب نشده' },
                  ...setups.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          </Card>

          {/* Market Context */}
          <Card>
            <CardHeader>
              <CardTitle>کانتکست بازار</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  کانتکست بازار
                </label>
                <VoiceTextarea
                  value={journalData.market_context || ''}
                  onChange={(v) => updateField('market_context', v)}
                  placeholder="شرایط کلی بازار را توصیف کنید..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="بایاس بازار"
                  value={journalData.market_bias || ''}
                  onChange={(e) => updateField('market_bias', e.target.value)}
                  placeholder="صعودی / نزولی / رنج"
                />
                <Input
                  label="تایم‌فریم"
                  value={journalData.timeframe || ''}
                  onChange={(e) => updateField('timeframe', e.target.value)}
                  placeholder="H1, H4, D1..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  سطوح مهم
                </label>
                <VoiceTextarea
                  value={journalData.important_levels || ''}
                  onChange={(v) => updateField('important_levels', v)}
                  placeholder="سطوح حمایت و مقاومت مهم..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  همگرایی‌ها (Confluences)
                </label>
                <VoiceTextarea
                  value={journalData.confluences || ''}
                  onChange={(v) => updateField('confluences', v)}
                  placeholder="عوامل تأییدکننده ورود..."
                />
              </div>
            </div>
          </Card>

          {/* Trade Thesis */}
          <Card>
            <CardHeader>
              <CardTitle>تز معامله</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  دلیل ورود
                </label>
                <VoiceTextarea
                  value={journalData.entry_reason || ''}
                  onChange={(v) => updateField('entry_reason', v)}
                  placeholder="چرا وارد این معامله شدید؟"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  سناریوی مورد انتظار
                </label>
                <VoiceTextarea
                  value={journalData.expected_scenario || ''}
                  onChange={(v) => updateField('expected_scenario', v)}
                  placeholder="انتظار داشتید چه اتفاقی بیفتد؟"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  شرط ابطال
                </label>
                <VoiceTextarea
                  value={journalData.invalidating_condition || ''}
                  onChange={(v) => updateField('invalidating_condition', v)}
                  placeholder="چه چیزی تحلیل را باطل می‌کرد؟"
                />
              </div>
            </div>
          </Card>

          {/* Risk Plan */}
          <Card>
            <CardHeader>
              <CardTitle>برنامه ریسک</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input
                label="ریسک برنامه‌ریزی‌شده ($)"
                type="number"
                value={journalData.planned_risk_amount?.toString() || ''}
                onChange={(e) => updateField('planned_risk_amount', e.target.value ? parseFloat(e.target.value) : null)}
                dir="ltr"
              />
              <Input
                label="ریسک برنامه‌ریزی‌شده (%)"
                type="number"
                value={journalData.planned_risk_percentage?.toString() || ''}
                onChange={(e) => updateField('planned_risk_percentage', e.target.value ? parseFloat(e.target.value) : null)}
                dir="ltr"
              />
              <Input
                label="R:R برنامه‌ریزی‌شده"
                type="number"
                step="0.1"
                value={journalData.planned_rr?.toString() || ''}
                onChange={(e) => updateField('planned_rr', e.target.value ? parseFloat(e.target.value) : null)}
                dir="ltr"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  اعتماد به نفس (۱-۱۰)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={journalData.confidence || 5}
                  onChange={(e) => updateField('confidence', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {journalData.confidence || 5}/10
                </p>
              </div>
            </div>
          </Card>

          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>چک‌لیست قبل از ورود</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {DEFAULT_CHECKLIST.map(item => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[item.key] || false}
                    onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'psychology' && (
        <div className="space-y-6">
          {/* Emotions */}
          <Card>
            <CardHeader>
              <CardTitle>احساسات</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <EmotionSelect
                label="احساس قبل از معامله"
                value={journalData.emotion_before || ''}
                onChange={(v) => updateField('emotion_before', v)}
              />
              <EmotionSelect
                label="احساس حین معامله"
                value={journalData.emotion_during || ''}
                onChange={(v) => updateField('emotion_during', v)}
              />
              <EmotionSelect
                label="احساس بعد از معامله"
                value={journalData.emotion_after || ''}
                onChange={(v) => updateField('emotion_after', v)}
              />
            </div>
          </Card>

          {/* Rule Adherence */}
          <Card>
            <CardHeader>
              <CardTitle>رعایت قوانین</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <Select
                label="وضعیت رعایت قوانین"
                value={journalData.rule_adherence || 'not_set'}
                onChange={(e) => updateField('rule_adherence', e.target.value as RuleAdherence)}
                options={RULE_ADHERENCE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  توضیحات رعایت قوانین
                </label>
                <VoiceTextarea
                  value={journalData.rule_adherence_notes || ''}
                  onChange={(v) => updateField('rule_adherence_notes', v)}
                  placeholder="توضیح دهید کدام قوانین رعایت یا نقض شدند..."
                />
              </div>
            </div>
          </Card>

          {/* Execution Quality */}
          <Card>
            <CardHeader>
              <CardTitle>کیفیت اجرا</CardTitle>
            </CardHeader>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                امتیاز کیفیت اجرا (۱-۱۰)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={journalData.execution_quality || 5}
                onChange={(e) => updateField('execution_quality', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                {journalData.execution_quality || 5}/10
              </p>
            </div>
          </Card>

          {/* Mistakes */}
          <Card>
            <CardHeader>
              <CardTitle>اشتباهات</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {mistakes.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMistakes(prev =>
                      prev.some(sm => sm.id === m.id)
                        ? prev.filter(sm => sm.id !== m.id)
                        : [...prev, { id: m.id }]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedMistakes.some(sm => sm.id === m.id)
                      ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {m.name}
                </button>
              ))}
              {mistakes.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">اشتباهی تعریف نشده. از تنظیمات اشتباه اضافه کنید.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>بازبینی بعد از معامله</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  چه چیزی خوب پیش رفت؟
                </label>
                <VoiceTextarea
                  value={journalData.what_went_well || ''}
                  onChange={(v) => updateField('what_went_well', v)}
                  placeholder="نقاط قوت این معامله..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  چه چیزی اشتباه پیش رفت؟
                </label>
                <VoiceTextarea
                  value={journalData.what_went_wrong || ''}
                  onChange={(v) => updateField('what_went_wrong', v)}
                  placeholder="نقاط ضعف و مشکلات..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  درس آموخته
                </label>
                <VoiceTextarea
                  value={journalData.lesson_learned || ''}
                  onChange={(v) => updateField('lesson_learned', v)}
                  placeholder="چه درسی از این معامله گرفتید؟"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  یادداشت‌های اضافی
                </label>
                <VoiceTextarea
                  value={journalData.post_trade_notes || ''}
                  onChange={(v) => updateField('post_trade_notes', v)}
                  placeholder="هر نکته دیگری که می‌خواهید ثبت کنید..."
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'screenshots' && user && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>اسکرین‌شات‌های معامله</CardTitle>
            </CardHeader>
            <div className="space-y-6">
              {/* Upload Area */}
              <TradeImageUpload
                tradeId={trade.id}
                userId={user.id}
                onUploadComplete={handleImageUpload}
              />

              {/* Images Grid */}
              {images.length > 0 ? (
                <TradeImageViewer
                  images={images}
                  onDelete={handleImageDelete}
                />
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>هنوز اسکرین‌شاتی آپلود نشده است</p>
                  <p className="text-sm mt-1">تصاویر نمودار معامله خود را آپلود کنید</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function EmotionSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map(emotion => (
          <button
            key={emotion}
            onClick={() => onChange(value === emotion ? '' : emotion)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              value === emotion
                ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {emotion}
          </button>
        ))}
      </div>
    </div>
  );
}

function VoiceTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />
      <VoiceInput onResult={(text) => onChange(value + (value ? ' ' : '') + text)} />
    </div>
  );
}
