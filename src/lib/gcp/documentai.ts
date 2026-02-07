import { DocumentUnderstandingServiceClient } from '@google-cloud/documentai';

const client = new DocumentUnderstandingServiceClient();

async function extractTextFromPdf(filePath) {
    const request = {
        inputConfig: {
            gcsSource: {
                // Set the GCS path to the PDF file
                uri: filePath,
            },
            mimeType: 'application/pdf',  // Change mime type if needed
        },
        feature: [{
            type: 'DOCUMENT_TEXT_DETECTION',
        }],
    };

    const [result] = await client.processDocument(request);
    return result;
}

async function extractTextFromImage(filePath) {
    const request = {
        inputConfig: {
            gcsSource: {
                // Set the GCS path to the image file
                uri: filePath,
            },
            mimeType: 'image/jpeg',  // Adjust mime type for different images
        },
        feature: [{
            type: 'DOCUMENT_TEXT_DETECTION',
        }],
    };

    const [result] = await client.processDocument(request);
    return result;
}

export { extractTextFromPdf, extractTextFromImage };