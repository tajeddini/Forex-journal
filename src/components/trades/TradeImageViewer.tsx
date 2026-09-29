// ============================================================
// Trade Image Viewer Component
// Displays trade images with lightbox functionality
// ============================================================

import { useState, useEffect } from 'react';
import { getTradeImageUrl } from '../../services/tradeImages';
import { formatFileSize, calculateCompressionRatio } from '../../utils/imageProcessing';
import { formatDateTime } from '../../utils/format';
import type { TradeImage } from '../../types/database';

interface TradeImageViewerProps {
  images: TradeImage[];
  onDelete?: (imageId: string) => void;
}

export function TradeImageViewer({ images, onDelete }: TradeImageViewerProps) {
  const [selectedImage, setSelectedImage] = useState<TradeImage | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedImage) {
      loadSignedUrl(selectedImage);
    } else {
      setImageUrl(null);
    }
  }, [selectedImage]);

  const loadSignedUrl = async (image: TradeImage) => {
    setLoading(true);
    try {
      const url = await getTradeImageUrl(image);
      setImageUrl(url);
    } catch (error) {
      console.error('Failed to load image URL:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setImageUrl(null);
  };

  const handleDelete = async (image: TradeImage) => {
    if (!onDelete) return;
    
    if (window.confirm('آیا مطمئن هستید که می‌خواهید این تصویر را حذف کنید؟')) {
      onDelete(image.id);
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <ImageThumbnail
            key={image.id}
            image={image}
            onClick={() => setSelectedImage(image)}
            onDelete={() => handleDelete(image)}
            showDelete={!!onDelete}
          />
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={handleClose}
        >
          <div
            className="relative max-w-7xl max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={selectedImage.original_filename}
                className="max-w-full max-h-[90vh] object-contain mx-auto"
              />
            ) : (
              <div className="flex items-center justify-center h-96 text-white">
                خطا در بارگذاری تصویر
              </div>
            )}

            {/* Image Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="text-white space-y-1">
                <p className="font-medium">{selectedImage.original_filename}</p>
                <div className="flex gap-4 text-sm text-gray-300">
                  {selectedImage.width && selectedImage.height && (
                    <span>{selectedImage.width} × {selectedImage.height}</span>
                  )}
                  <span>اصلی: {formatFileSize(selectedImage.original_size_bytes)}</span>
                  <span>پردازش‌شده: {formatFileSize(selectedImage.processed_size_bytes)}</span>
                  <span>
                    فشرده‌سازی: {calculateCompressionRatio(
                      selectedImage.original_size_bytes,
                      selectedImage.processed_size_bytes
                    ).toFixed(1)}%
                  </span>
                  <span>{formatDateTime(selectedImage.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ImageThumbnailProps {
  image: TradeImage;
  onClick: () => void;
  onDelete: () => void;
  showDelete: boolean;
}

function ImageThumbnail({ image, onClick, onDelete, showDelete }: ImageThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUrl();
  }, [image]);

  const loadUrl = async () => {
    try {
      const url = await getTradeImageUrl(image);
      setImageUrl(url);
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={image.original_filename}
          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onClick}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          خطا در بارگذاری
        </div>
      )}

      {/* Overlay with delete button */}
      {showDelete && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
