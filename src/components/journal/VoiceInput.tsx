import { useState, useCallback } from 'react';
import { getSpeechToText } from '../../services/speechToText';
import { useToast } from '../../contexts/ToastContext';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onResult, className = '' }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const toast = useToast();
  const stt = getSpeechToText();

  const handleToggle = useCallback(() => {
    if (!stt.isSupported()) {
      toast.warning('مرورگر شما از تبدیل صدا به متن پشتیبانی نمی‌کند. از Chrome یا Edge استفاده کنید.');
      return;
    }

    if (isListening) {
      stt.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      stt.start({
        language: 'fa-IR',
        onResult: (text) => {
          onResult(text);
        },
        onError: (error) => {
          toast.error(error);
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
        },
      });
    }
  }, [isListening, stt, onResult, toast]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        absolute bottom-2 left-2 p-2 rounded-lg transition-colors
        ${isListening
          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
        ${className}
      `}
      title={isListening ? 'توقف ضبط' : 'شروع ضبط صدا'}
      aria-label={isListening ? 'توقف ضبط' : 'شروع ضبط صدا'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {isListening ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        )}
      </svg>
    </button>
  );
}
