package service

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

// buildTestDocx creates a minimal .docx ZIP with the given XML in word/document.xml.
func buildTestDocx(t *testing.T, documentXML string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	f, err := w.Create("word/document.xml")
	if err != nil {
		t.Fatalf("create zip entry: %v", err)
	}
	if _, err := f.Write([]byte(documentXML)); err != nil {
		t.Fatalf("write zip entry: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

func TestExtractDocxText_SimpleParagraph(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello World</w:t></w:r></w:p>
  </w:body>
</w:document>`

	data := buildTestDocx(t, xml)
	text, err := extractDocxText(data)
	if err != nil {
		t.Fatalf("extractDocxText: %v", err)
	}
	if !strings.Contains(text, "Hello World") {
		t.Errorf("expected 'Hello World' in text, got %q", text)
	}
}

func TestExtractDocxText_MultipleParagraphs(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
    <w:p><w:r><w:t>Third paragraph</w:t></w:r></w:p>
  </w:body>
</w:document>`

	data := buildTestDocx(t, xml)
	text, err := extractDocxText(data)
	if err != nil {
		t.Fatalf("extractDocxText: %v", err)
	}

	lines := strings.Split(text, "\n")
	nonEmpty := 0
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			nonEmpty++
		}
	}
	if nonEmpty < 3 {
		t.Errorf("expected at least 3 non-empty lines, got %d in:\n%s", nonEmpty, text)
	}
	if !strings.Contains(text, "First paragraph") {
		t.Errorf("missing 'First paragraph' in text")
	}
	if !strings.Contains(text, "Third paragraph") {
		t.Errorf("missing 'Third paragraph' in text")
	}
}

func TestExtractDocxText_MultipleRunsInParagraph(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Hello </w:t></w:r>
      <w:r><w:t>World</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`

	data := buildTestDocx(t, xml)
	text, err := extractDocxText(data)
	if err != nil {
		t.Fatalf("extractDocxText: %v", err)
	}
	if !strings.Contains(text, "Hello World") {
		t.Errorf("expected 'Hello World' in text, got %q", text)
	}
}

func TestExtractDocxText_EmptyDocument(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t></w:t></w:r></w:p>
  </w:body>
</w:document>`

	data := buildTestDocx(t, xml)
	_, err := extractDocxText(data)
	if err == nil {
		t.Fatal("expected error for empty document")
	}
}

func TestExtractDocxText_InvalidZip(t *testing.T) {
	_, err := extractDocxText([]byte("not a zip file"))
	if err == nil {
		t.Fatal("expected error for invalid zip")
	}
}

func TestExtractDocxText_MissingDocumentXML(t *testing.T) {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	f, _ := w.Create("word/styles.xml")
	f.Write([]byte("<styles/>"))
	w.Close()

	_, err := extractDocxText(buf.Bytes())
	if err == nil {
		t.Fatal("expected error when word/document.xml is missing")
	}
}

func TestExtract_Docx_Success(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Contract agreement between parties.</w:t></w:r></w:p>
  </w:body>
</w:document>`

	docxData := buildTestDocx(t, xml)
	client := &mockDocAIClient{} // should NOT be called for .docx
	dl := &mockObjectDownloader{data: docxData}
	svc := NewParserService(client, "projects/test/locations/us/processors/abc", dl, "bucket")

	result, err := svc.Extract(t.Context(), "gs://bucket/uploads/user1/doc1/contract.docx")
	if err != nil {
		t.Fatalf("Extract() error: %v", err)
	}
	if !strings.Contains(result.Text, "Contract agreement") {
		t.Errorf("expected 'Contract agreement' in text, got %q", result.Text)
	}
	if result.Pages != 1 {
		t.Errorf("Pages = %d, want 1", result.Pages)
	}
}
