// ============================================================
// Trade Image Upload Component
// Handles image upload with drag & drop and file picker
// ============================================================

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { uploadTradeImage } from '../../services/tradeImages';
import { validateImageFile, formatFileSize } from '../../utils/imageProcessing';
import { Button } from '../ui/Button';
import type { TradeImage } from '../../types/database';

interface TradeImageUploadProps {
  tradeId: string;
  userId: string;
  onUploadComplete: (image: TradeImage) => void;
}

export function TradeImageUpload({ tradeId, userId, onUploadComplete }: TradeImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFile = async (file: File) => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'فایل نامعتبر است');
      return;
    }

    setIsUploading(true);
    try {
      const image = await uploadTradeImage(tradeId, userId, file);
      onUploadComplete(image);
      toast.success('تصویر با موفقیت آپلود شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در آپلود تصویر');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors
        ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {isUploading ? (
        <div className="space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-gray-600 dark:text-gray-400">در حال آپلود...</p>
        </div>
      ) : (
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            تصویر را اینجا رها کنید یا کلیک کنید
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            JPEG, PNG, WebP - حداکثر 10MB
          </p>
        </div>
      )}
    </div>
  );
}
