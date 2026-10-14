import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from './auth-errors';

describe('getAuthErrorMessage', () => {
  it('returns Persian message for invalid credentials', () => {
    const result = getAuthErrorMessage('Invalid login credentials');
    expect(result).toBe('ایمیل یا رمز عبور اشتباه است');
  });

  it('returns Persian message for unconfirmed email', () => {
    const result = getAuthErrorMessage('Email not confirmed');
    expect(result).toBe('لطفاً ابتدا ایمیل خود را تأیید کنید');
  });

  it('returns Persian message for already registered user', () => {
    const result = getAuthErrorMessage('User already registered');
    expect(result).toBe('این ایمیل قبلاً ثبت شده است');
  });

  it('returns Persian message for short password', () => {
    const result = getAuthErrorMessage('Password should be at least 6 characters');
    expect(result).toBe('رمز عبور باید حداقل ۶ کاراکتر باشد');
  });

  it('returns Persian message for too many requests', () => {
    const result = getAuthErrorMessage('Too many requests');
    expect(result).toBe('تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید');
  });

  it('explains Supabase email send rate limits', () => {
    expect(getAuthErrorMessage('email rate limit exceeded')).toContain('محدودیت ارسال ایمیل');
    expect(getAuthErrorMessage('over_email_send_rate_limit')).toContain('محدودیت ارسال ایمیل');
    expect(getAuthErrorMessage('Email rate limit exceeded')).toContain('محدودیت ارسال ایمیل');
    expect(getAuthErrorMessage('AuthApiError: Email rate limit exceeded')).toContain('محدودیت ارسال ایمیل');
  });

  it('returns Persian message for network failure', () => {
    const result = getAuthErrorMessage('Network request failed');
    expect(result).toBe('خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید');
  });

  it('returns default message for unknown errors', () => {
    const result = getAuthErrorMessage('Some unknown error');
    expect(result).toBe('خطای ناشناخته. لطفاً دوباره تلاش کنید');
  });

  it('returns default message for empty string', () => {
    const result = getAuthErrorMessage('');
    expect(result).toBe('خطای ناشناخته. لطفاً دوباره تلاش کنید');
  });
});
