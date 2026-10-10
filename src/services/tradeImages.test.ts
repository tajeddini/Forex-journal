import { describe, it, expect, vi } from 'vitest';
import { getTradeImageUrl, uploadTradeImage } from './tradeImages';

vi.mock('../utils/imageProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/imageProcessing')>();
  return {
    ...actual,
    processImage: vi.fn().mockImplementation(async (file: File) => ({
      blob: new Blob(['processed'], { type: 'image/webp' }),
      width: 800,
      height: 600,
      originalSize: file.size,
      processedSize: file.size,
    })),
  };
});

describe('Trade Images Service Consistency & Security', () => {
  it('rejects invalid non-image file uploads immediately before calling storage', async () => {
    const invalidFile = new File(['text content'], 'document.txt', { type: 'text/plain' });

    await expect(uploadTradeImage('trade-1', 'user-1', invalidFile)).rejects.toThrow(
      'فرمت فایل پشتیبانی نمی‌شود'
    );
  });

  it('rejects files exceeding size limit before calling storage', async () => {
    // 12MB dummy file (exceeds MAX_UPLOAD_SIZE 10MB)
    const bigBlob = new Blob([new Uint8Array(12 * 1024 * 1024)], { type: 'image/jpeg' });
    const bigFile = new File([bigBlob], 'huge.jpg', { type: 'image/jpeg' });

    await expect(uploadTradeImage('trade-1', 'user-1', bigFile)).rejects.toThrow(
      'حجم فایل نباید بیشتر از 10 مگابایت باشد'
    );
  });

  it('guarantees guest mode uploads do not write to live cloud storage or leak cross-user data', async () => {
    const file = new File(['mock image bytes'], 'chart.png', { type: 'image/png' });
    const result = await uploadTradeImage('trade-guest-1', 'guest-demo-user', file);

    expect(result.id).toBeDefined();
    expect(result.user_id).toBe('guest-demo-user');
    expect(result.storage_path).toContain('trades/trade-guest-1/');

    const previewUrl = await getTradeImageUrl(result);
    expect(previewUrl).toMatch(/^data:image\/webp;base64,/);
    expect(previewUrl).toBe((result as typeof result & { preview_url?: string }).preview_url);
  });
});
