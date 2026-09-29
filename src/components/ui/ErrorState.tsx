import { type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  icon?: ReactNode;
}

export function ErrorState({ title = 'خطا', message, retry, icon }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon ? (
        <div className="mb-4 text-red-400">{icon}</div>
      ) : (
        <div className="mb-4 text-red-400">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {message}
      </p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}
