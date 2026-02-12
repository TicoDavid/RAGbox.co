package service

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"strings"
)

// extractDocxText extracts plain text from .docx file bytes.
// A .docx file is a ZIP archive containing XML; the main body text
// lives in word/document.xml as <w:t> elements.
func extractDocxText(data []byte) (string, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("open docx zip: %w", err)
	}

	var docFile *zip.File
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			docFile = f
			break
		}
	}
	if docFile == nil {
		return "", fmt.Errorf("word/document.xml not found in docx archive")
	}

	rc, err := docFile.Open()
	if err != nil {
		return "", fmt.Errorf("open word/document.xml: %w", err)
	}
	defer rc.Close()

	xmlData, err := io.ReadAll(rc)
	if err != nil {
		return "", fmt.Errorf("read word/document.xml: %w", err)
	}

	return parseDocumentXML(xmlData)
}

// parseDocumentXML walks the OOXML body and extracts text runs.
// It inserts newlines at paragraph boundaries and spaces between runs.
func parseDocumentXML(data []byte) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	decoder.Strict = false
	decoder.AutoClose = xml.HTMLAutoClose

	var (
		buf        strings.Builder
		inText     bool
		inPara     bool
		paraHasText bool
	)

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse document xml: %w", err)
		}

		switch t := tok.(type) {
		case xml.StartElement:
			local := t.Name.Local
			switch local {
			case "p": // <w:p> — paragraph
				if inPara && paraHasText {
					buf.WriteByte('\n')
				}
				inPara = true
				paraHasText = false
			case "t": // <w:t> — text run
				inText = true
			case "tab": // <w:tab>
				buf.WriteByte('\t')
			case "br": // <w:br>
				buf.WriteByte('\n')
			}
		case xml.EndElement:
			local := t.Name.Local
			switch local {
			case "t":
				inText = false
			case "p":
				if paraHasText {
					buf.WriteByte('\n')
				}
				inPara = false
			}
		case xml.CharData:
			if inText {
				text := string(t)
				if text != "" {
					buf.WriteString(text)
					paraHasText = true
				}
			}
		}
	}

	result := strings.TrimSpace(buf.String())
	if result == "" {
		return "", fmt.Errorf("no text content found in docx")
	}
	return result, nil
}
