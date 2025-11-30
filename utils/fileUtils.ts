
import JSZip from 'jszip';

/**
 * Helper to infer mime type from filename extension.
 * Essential for files extracted from ZIPs where MIME type metadata is often lost.
 * @param filename - The name of the file.
 * @returns The corresponding MIME type string.
 */
const getMimeTypeFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'webp': return 'image/webp';
        case 'heic': return 'image/heic';
        case 'heif': return 'image/heif';
        case 'pdf': return 'application/pdf';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case 'txt': return 'text/plain';
        case 'csv': return 'text/csv';
        default: return 'application/octet-stream';
    }
};

/**
 * Converts a File object to a base64 encoded string.
 * @param file - The File object to convert.
 * @returns A promise that resolves with the base64 string (without the data URL prefix).
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); // remove the data:mime/type;base64, part
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Extracts files from a ZIP archive.
 * Ignores directories and hidden system files (like __MACOSX).
 * Auto-detects MIME type based on extension if missing.
 * @param zipFile - The .zip file.
 * @returns A promise resolving to an array of File objects extracted from the zip.
 */
export const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extractedFiles: File[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            // Cast to any to handle type inference issues with JSZip
            const entry = fileEntry as any;
            
            // Skip directories and hidden files (common in Mac/Windows zips)
            if (entry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('/.') || relativePath.startsWith('.')) {
                continue;
            }

            const blob = await entry.async('blob');
            // Extract filename from path (handle nested folders by taking the basename)
            const fileName = relativePath.split('/').pop() || relativePath;
            
            // Fix: Explicitly determine MIME type from extension if blob type is missing or generic
            let mimeType = blob.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
                mimeType = getMimeTypeFromFilename(fileName);
            }
            
            // Create a new File object with the correct MIME type
            const file = new File([blob], fileName, { type: mimeType });
            extractedFiles.push(file);
        }
        return extractedFiles;
    } catch (error) {
        console.error("Error unzipping file:", error);
        throw new Error(`Gagal mengekstrak file ZIP: ${zipFile.name}`);
    }
};

/**
 * Processes a list of raw uploaded files. 
 * Checks for ZIP files and expands them, flattening the final list.
 * Also ensures regular files have correct MIME types.
 * @param files - Array of files from the input element.
 * @returns A promise resolving to a flat array of processed files.
 */
export const processUploadedFiles = async (files: File[]): Promise<File[]> => {
    const processedFiles: File[] = [];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
            try {
                const unzippedFiles = await extractFilesFromZip(file);
                processedFiles.push(...unzippedFiles);
            } catch (e) {
                console.warn(`Could not unzip ${file.name}, skipping.`, e);
            }
        } else {
            // Handle regular files: check if we need to fix the MIME type
            if (!file.type || file.type === 'application/octet-stream') {
                const fixedType = getMimeTypeFromFilename(file.name);
                if (fixedType !== 'application/octet-stream') {
                    // Recreate file with correct type
                    processedFiles.push(new File([file], file.name, { type: fixedType }));
                    continue;
                }
            }
            processedFiles.push(file);
        }
    }
    return processedFiles;
};
