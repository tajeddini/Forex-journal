// ============================================================
// Speech-to-Text Abstraction Layer
// Uses Web Speech API for MVP, extensible for future providers
// ============================================================

export interface SpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeechToTextService {
  isSupported(): boolean;
  start(options?: SpeechToTextOptions): void;
  stop(): void;
  isListening(): boolean;
}

class WebSpeechService implements SpeechToTextService {
  private recognition: any = null;
  private listening = false;

  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  start(options: SpeechToTextOptions = {}): void {
    if (!this.isSupported()) {
      options.onError?.('مرورگر شما از تبدیل صدا به متن پشتیبانی نمی‌کند');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.lang = options.language || 'fa-IR';
    this.recognition.continuous = options.continuous ?? false;
    this.recognition.interimResults = options.interimResults ?? true;

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        options.onResult?.(finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.listening = false;
      const errorMessages: Record<string, string> = {
        'no-speech': 'صدایی شنیده نشد',
        'audio-capture': 'میکروفن در دسترس نیست',
        'not-allowed': 'دسترسی به میکروفن رد شد',
        'network': 'خطای شبکه',
      };
      options.onError?.(errorMessages[event.error] || 'خطای ناشناخته در تبدیل صدا');
    };

    this.recognition.onend = () => {
      this.listening = false;
      options.onEnd?.();
    };

    try {
      this.recognition.start();
      this.listening = true;
    } catch (err) {
      options.onError?.('خطا در شروع ضبط صدا');
    }
  }

  stop(): void {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }

  isListening(): boolean {
    return this.listening;
  }
}

// Singleton instance
let instance: SpeechToTextService | null = null;

export function getSpeechToText(): SpeechToTextService {
  if (!instance) {
    instance = new WebSpeechService();
  }
  return instance;
}

// Hook for React components
export function useSpeechToText() {
  const stt = getSpeechToText();
  
  return {
    isSupported: () => stt.isSupported(),
    start: (options?: SpeechToTextOptions) => stt.start(options),
    stop: () => stt.stop(),
    isListening: () => stt.isListening(),
  };
}
