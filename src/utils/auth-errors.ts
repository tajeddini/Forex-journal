// Auth error message mapping utility
export function getAuthErrorMessage(message: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'ایمیل یا رمز عبور اشتباه است',
    'Email not confirmed': 'لطفاً ابتدا ایمیل خود را تأیید کنید',
    'User already registered': 'این ایمیل قبلاً ثبت شده است',
    'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
    'Too many requests': 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید',
    'email rate limit exceeded': 'به‌دلیل محدودیت ارسال ایمیل، فعلاً امکان ارسال ایمیل تأیید وجود ندارد. کمی بعد دوباره تلاش کنید',
    'over_email_send_rate_limit': 'به‌دلیل محدودیت ارسال ایمیل، فعلاً امکان ارسال ایمیل تأیید وجود ندارد. کمی بعد دوباره تلاش کنید',
    'Email address is invalid': 'آدرس ایمیل معتبر نیست. لطفاً ایمیل دیگری وارد کنید',
    'email_address_invalid': 'آدرس ایمیل معتبر نیست. لطفاً ایمیل دیگری وارد کنید',
    'Network request failed': 'خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید',
  };
  const normalizedMessage = message.trim().toLowerCase();
  const matchingEntry = Object.entries(errorMap).find(([key]) =>
    normalizedMessage === key.toLowerCase() || normalizedMessage.includes(key.toLowerCase())
  );

  return matchingEntry?.[1] || 'خطای ناشناخته. لطفاً دوباره تلاش کنید';
}
