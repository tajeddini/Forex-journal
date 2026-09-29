import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('لطفاً ایمیل خود را وارد کنید');
      return;
    }
    if (!password) {
      setError('لطفاً رمز عبور خود را وارد کنید');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
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
            وارد حساب کاربری خود شوید
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              ورود
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          حساب کاربری ندارید؟{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
          >
            ثبت‌نام کنید
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          یا{' '}
          <Link
            to="/guest"
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
          >
            به عنوان مهمان وارد شوید
          </Link>
        </p>
      </div>
    </div>
  );
}
