import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('لطفاً ایمیل خود را وارد کنید');
      return;
    }
    if (!password) {
      setError('لطفاً رمز عبور خود را وارد کنید');
      return;
    }
    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }
    if (password !== confirmPassword) {
      setError('رمز عبور و تکرار آن مطابقت ندارند');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, displayName || undefined);
    if (error) {
      setError(error);
    } else {
      setSuccess('ثبت‌نام با موفقیت انجام شد. لطفاً ایمیل خود را تأیید کنید.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 dark:bg-blue-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ژورنال معاملاتی
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            حساب کاربری جدید بسازید
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            <Input
              label="نام نمایشی"
              type="text"
              placeholder="نام شما"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

            <Input
              label="ایمیل"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
            />

            <Input
              label="رمز عبور"
              type="password"
              placeholder="حداقل ۶ کاراکتر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />

            <Input
              label="تکرار رمز عبور"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              ثبت‌نام
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link
            to="/login"
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
          >
            وارد شوید
          </Link>
        </p>
      </div>
    </div>
  );
}
