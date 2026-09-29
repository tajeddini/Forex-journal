// Auth error message mapping utility
export function getAuthErrorMessage(message: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'ایمیل یا رمز عبور اشتباه است',
    'Email not confirmed': 'لطفاً ابتدا ایمیل خود را تأیید کنید',
    'User already registered': 'این ایمیل قبلاً ثبت شده است',
    'Password should be at least 6 characters': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
    'Too many requests': 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید',
    'Network request failed': 'خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید',
  };
  return errorMap[message] || 'خطای ناشناخته. لطفاً دوباره تلاش کنید';
}
