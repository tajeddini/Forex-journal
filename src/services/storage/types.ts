// ============================================================
// Storage Provider Interface
// Abstract interface for storage providers
// ============================================================

export interface StorageProvider {
  /**
   * Upload a file to storage
   */
  upload(params: {
    path: string;
    file: File | Blob;
    contentType: string;
  }): Promise<{
    path: string;
    size: number;
  }>;

  /**
   * Delete a file from storage
   */
  delete(path: string): Promise<void>;

  /**
   * Get a signed URL for accessing a file
   */
  getSignedUrl(path: string, expirySeconds?: number): Promise<string>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;
}

export interface StorageService {
  getProvider(): StorageProvider;
}
