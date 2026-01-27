/**
 * Cloud Storage Client - RAGbox.co
 *
 * GCS integration for document upload, download, and management.
 */

import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'ragbox-documents-prod'

export interface UploadResult {
  gcsUri: string
  publicUrl: string
  fileName: string
  size: number
}

export interface FileMetadata {
  name: string
  size: number
  contentType: string
  created: string
  updated: string
  md5Hash?: string
  crc32c?: string
  metadata?: Record<string, string>
}

export class StorageClient {
  private bucket = storage.bucket(BUCKET_NAME)

  /**
   * Upload a file to GCS
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    userId: string
  ): Promise<UploadResult> {
    const destination = `users/${userId}/documents/${Date.now()}-${fileName}`
    const file = this.bucket.file(destination)

    await file.save(fileBuffer, {
      contentType,
      metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    })

    return {
      gcsUri: `gs://${BUCKET_NAME}/${destination}`,
      publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`,
      fileName,
      size: fileBuffer.length,
    }
  }

  /**
   * Download a file from GCS
   */
  async downloadFile(gcsUri: string): Promise<Buffer> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '')
    const [contents] = await this.bucket.file(fileName).download()
    return contents
  }

  /**
   * Get file metadata from GCS
   */
  async getFileMetadata(gcsUri: string): Promise<FileMetadata> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '')
    const [metadata] = await this.bucket.file(fileName).getMetadata()

    return {
      name: metadata.name || fileName,
      size: Number(metadata.size) || 0,
      contentType: metadata.contentType || 'application/octet-stream',
      created: metadata.timeCreated || '',
      updated: metadata.updated || '',
      md5Hash: metadata.md5Hash || undefined,
      crc32c: metadata.crc32c || undefined,
      metadata: metadata.metadata as Record<string, string> | undefined,
    }
  }

  /**
   * List files for a user
   */
  async listUserFiles(userId: string): Promise<string[]> {
    const [files] = await this.bucket.getFiles({
      prefix: `users/${userId}/documents/`,
    })

    return files.map((file) => `gs://${BUCKET_NAME}/${file.name}`)
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(gcsUri: string): Promise<void> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '')
    try {
      await this.bucket.file(fileName).delete()
    } catch (error) {
      console.error(`Failed to delete GCS file ${gcsUri}:`, error)
      throw error
    }
  }

  /**
   * Get signed URL for temporary access
   */
  async getSignedUrl(gcsUri: string, expiresInMinutes = 60): Promise<string> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '')
    const [url] = await this.bucket.file(fileName).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    })
    return url
  }

  /**
   * Check if a file exists in GCS
   */
  async fileExists(gcsUri: string): Promise<boolean> {
    const fileName = gcsUri.replace(`gs://${BUCKET_NAME}/`, '')
    const [exists] = await this.bucket.file(fileName).exists()
    return exists
  }
}

export const storageClient = new StorageClient()
