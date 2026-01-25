/**
 * Dashboard Utility Functions for RAGbox
 */

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g. "data:image/png;base64,") to get raw base64
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const getFileTypeDescription = (file: File): { typeDescription: string; isImage: boolean } => {
  let typeDescription = "Text Document";
  let isImage = false;

  if (file.type.startsWith('image/')) {
    typeDescription = "Visual Asset";
    isImage = true;
  } else if (file.type.startsWith('audio/')) {
    typeDescription = "Audio Record";
  } else if (file.type.startsWith('video/')) {
    typeDescription = "Video Footage";
  } else if (file.type.includes('pdf')) {
    typeDescription = "PDF Document";
  }

  return { typeDescription, isImage };
};
