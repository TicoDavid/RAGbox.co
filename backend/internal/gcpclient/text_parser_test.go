package gcpclient

import (
	"context"
	"fmt"
	"testing"
)

// mockDownloader implements ObjectDownloader for testing.
type mockDownloader struct {
	data []byte
	err  error
}

func (m *mockDownloader) Download(ctx context.Context, bucket, object string) ([]byte, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.data, nil
}

func TestTextParser_Extract_Success(t *testing.T) {
	dl := &mockDownloader{data: []byte("Hello, world!")}
	parser := NewTextParser(dl)

	result, err := parser.Extract(context.Background(), "gs://my-bucket/uploads/user/doc/file.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != "Hello, world!" {
		t.Errorf("Text = %q, want %q", result.Text, "Hello, world!")
	}
	if result.Pages != 1 {
		t.Errorf("Pages = %d, want 1", result.Pages)
	}
}

func TestTextParser_Extract_EmptyURI(t *testing.T) {
	dl := &mockDownloader{}
	parser := NewTextParser(dl)

	_, err := parser.Extract(context.Background(), "")
	if err == nil {
		t.Fatal("expected error for empty URI")
	}
}

func TestTextParser_Extract_InvalidURI(t *testing.T) {
	dl := &mockDownloader{}
	parser := NewTextParser(dl)

	_, err := parser.Extract(context.Background(), "https://not-gcs.com/bucket/object")
	if err == nil {
		t.Fatal("expected error for non-gs:// URI")
	}
}

func TestTextParser_Extract_DownloadError(t *testing.T) {
	dl := &mockDownloader{err: fmt.Errorf("network error")}
	parser := NewTextParser(dl)

	_, err := parser.Extract(context.Background(), "gs://bucket/path/to/file.txt")
	if err == nil {
		t.Fatal("expected error on download failure")
	}
}

func TestTextParser_Extract_EmptyContent(t *testing.T) {
	dl := &mockDownloader{data: []byte{}}
	parser := NewTextParser(dl)

	result, err := parser.Extract(context.Background(), "gs://bucket/path/to/empty.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != "" {
		t.Errorf("Text = %q, want empty", result.Text)
	}
}

func TestParseGCSURI(t *testing.T) {
	tests := []struct {
		name       string
		uri        string
		wantBucket string
		wantObject string
		wantErr    bool
	}{
		{
			name:       "simple path",
			uri:        "gs://my-bucket/file.txt",
			wantBucket: "my-bucket",
			wantObject: "file.txt",
		},
		{
			name:       "nested path",
			uri:        "gs://my-bucket/uploads/user-1/doc-1/report.pdf",
			wantBucket: "my-bucket",
			wantObject: "uploads/user-1/doc-1/report.pdf",
		},
		{
			name:    "empty string",
			uri:     "",
			wantErr: true,
		},
		{
			name:    "no gs prefix",
			uri:     "https://storage.googleapis.com/bucket/obj",
			wantErr: true,
		},
		{
			name:    "bucket only",
			uri:     "gs://my-bucket",
			wantErr: true,
		},
		{
			name:    "empty bucket",
			uri:     "gs:///object",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bucket, object, err := parseGCSURI(tt.uri)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if bucket != tt.wantBucket {
				t.Errorf("bucket = %q, want %q", bucket, tt.wantBucket)
			}
			if object != tt.wantObject {
				t.Errorf("object = %q, want %q", object, tt.wantObject)
			}
		})
	}
}
