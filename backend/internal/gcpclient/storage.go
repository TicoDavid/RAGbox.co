package gcpclient

import (
	"context"
	"fmt"
	"io"
	"time"

	"cloud.google.com/go/storage"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// StorageAdapter wraps the GCS client to implement service.StorageClient and service.ObjectUploader.
type StorageAdapter struct {
	client *storage.Client
}

// NewStorageAdapter creates a StorageAdapter.
func NewStorageAdapter(ctx context.Context) (*StorageAdapter, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.NewStorageAdapter: %w", err)
	}
	return &StorageAdapter{client: client}, nil
}

// SignedURL generates a signed URL for client-side upload/download.
func (a *StorageAdapter) SignedURL(bucket, object string, opts *service.SignedURLOptions) (string, error) {
	return a.client.Bucket(bucket).SignedURL(object, &storage.SignedURLOptions{
		Method:      opts.Method,
		Expires:     opts.Expires,
		ContentType: opts.ContentType,
	})
}

// Upload writes data to a GCS object.
func (a *StorageAdapter) Upload(ctx context.Context, bucket, object string, data []byte, contentType string) error {
	w := a.client.Bucket(bucket).Object(object).NewWriter(ctx)
	w.ContentType = contentType
	if _, err := w.Write(data); err != nil {
		w.Close()
		return fmt.Errorf("gcpclient.Upload write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("gcpclient.Upload close: %w", err)
	}
	return nil
}

// SignedDownloadURL generates a signed GET URL for downloading an object.
func (a *StorageAdapter) SignedDownloadURL(ctx context.Context, bucket, object string, expiry time.Duration) (string, error) {
	url, err := a.client.Bucket(bucket).SignedURL(object, &storage.SignedURLOptions{
		Method:  "GET",
		Expires: time.Now().Add(expiry),
	})
	if err != nil {
		return "", fmt.Errorf("gcpclient.SignedDownloadURL: %w", err)
	}
	return url, nil
}

// Download reads an object from GCS.
func (a *StorageAdapter) Download(ctx context.Context, bucket, object string) ([]byte, error) {
	r, err := a.client.Bucket(bucket).Object(object).NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("gcpclient.Download: %w", err)
	}
	defer r.Close()
	return io.ReadAll(r)
}

// Close closes the underlying client.
func (a *StorageAdapter) Close() {
	a.client.Close()
}
