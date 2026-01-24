import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'ragbox-documents-prod';

export interface UploadResult {
  gcsUri: string;
  publicUrl: string;
  fileName: string;
  size: number;
}

export class StorageClient {
  private bucket = storage.bucket(BUCKET_NAME);

  /**
   * Upload a file to GCS
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    userId: string
  ): Promise<UploadResult> {
    const destination = `users/${userId}/documents/${Date.now()}-${fileName}`;
    const file = this.bucket.file(destination);

    await file.save(fileBuffer, {
      contentType,
      metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      gcsUri: `gs://${BUCKET_NAME}/${destination}`,
      publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      fileName,
      size: fileBuffer.length,
    };
  }

  /**
   * List files for a user
   */
  async listUserFiles(userId: string): Promise<string[]> {
    const [files] = await this.bucket.getFiles({
      prefix: `users/${userId}/documents/`,
    });

    return files.map((file) => `gs://${BUCKET_NAME}/${file.name}`);
  }

  /**
   * Delete a file
   */
  async deleteFile(gcsUri: string): Promise<void> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '');
    await this.bucket.file(fileName).delete();
  }

  /**
   * Get signed URL for temporary access
   */
  async getSignedUrl(gcsUri: string, expiresInMinutes = 60): Promise<string> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '');
    const [url] = await this.bucket.file(fileName).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return url;
  }
}

export const storageClient = new StorageClient();