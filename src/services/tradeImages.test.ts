import { describe, it, expect, vi } from 'vitest';
import { uploadTradeImage } from './tradeImages';

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
});
