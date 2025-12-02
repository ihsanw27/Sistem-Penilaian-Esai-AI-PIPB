
/**
 * @file fileUtils.ts
 * @description Menyediakan utilitas untuk operasi file, khususnya:
 * 1. Konversi Base64 untuk upload API.
 * 2. Ekstraksi ZIP (Unzipping) untuk upload batch/massal.
 * 3. Inferensi tipe MIME cerdas.
 * 4. Logika pengelompokan file berdasarkan struktur folder ZIP.
 */

import JSZip from 'jszip';
import { StudentSubmission } from '../types';

/**
 * Pembantu untuk menyimpulkan tipe mime dari ekstensi nama file.
 * @param filename - Nama file.
 * @returns String tipe MIME IANA yang sesuai.
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
 * Mengonversi objek File ke string yang dikodekan base64.
 * @param file - Objek File yang akan dikonversi.
 * @returns Promise yang diselesaikan dengan string base64.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); 
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Helper internal untuk membersihkan entri zip (membuang direktori sistem MacOS/Hidden).
 */
const isValidZipEntry = (relativePath: string, entry: any) => {
    return !(entry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('/.') || relativePath.startsWith('.'));
};

/**
 * Helper internal untuk memperbaiki tipe MIME.
 */
const createFileFromBlob = (blob: Blob, fileName: string) => {
    let mimeType = blob.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = getMimeTypeFromFilename(fileName);
    }
    return new File([blob], fileName, { type: mimeType });
};

/**
 * Mengekstrak file dari ZIP. (Versi Datar/Flat).
 * Digunakan oleh Mode Individu atau input Dosen (menggabungkan semua jadi satu konteks).
 */
export const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extractedFiles: File[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            const entry = fileEntry as any;
            if (!isValidZipEntry(relativePath, entry)) continue;

            const blob = await entry.async('blob');
            const fileName = relativePath.split('/').pop() || relativePath;
            extractedFiles.push(createFileFromBlob(blob, fileName));
        }
        return extractedFiles;
    } catch (error) {
        console.error("Error unzipping file:", error);
        throw new Error(`Gagal mengekstrak file ZIP: ${zipFile.name}`);
    }
};

/**
 * Struktur internal untuk menyimpan file dengan path relatifnya.
 */
interface FileWithRelPath {
    file: File;
    path: string;
}

/**
 * Mengekstrak file dari ZIP namun mempertahankan informasi struktur folder.
 * Digunakan untuk Mode Kelas agar bisa mendeteksi grouping.
 */
export const extractFilesFromZipWithPaths = async (zipFile: File): Promise<FileWithRelPath[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extracted: FileWithRelPath[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            const entry = fileEntry as any;
            if (!isValidZipEntry(relativePath, entry)) continue;

            const blob = await entry.async('blob');
            const fileName = relativePath.split('/').pop() || relativePath;
            const file = createFileFromBlob(blob, fileName);
            
            extracted.push({ file, path: relativePath });
        }
        return extracted;
    } catch (error) {
         console.error("Error unzipping file with paths:", error);
         throw new Error(`Gagal mengekstrak file ZIP: ${zipFile.name}`);
    }
};

/**
 * Memproses file upload untuk Mode Kelas dengan logika pengelompokan cerdas.
 * 
 * ALGORITMA GROUPING (VERSION 2.1 - Mixed Content Support):
 * 1. **Ekstraksi**: Membaca ZIP beserta struktur direktorinya.
 * 2. **Deteksi Common Root**: Membuang folder induk jika semua file ada di dalamnya.
 * 3. **Grouping Hibrida**:
 *    - **Folder**: Jika file ada dalam sub-folder, nama folder = Nama Mahasiswa.
 *    - **File Datar**: Jika file ada di root, nama file (tanpa ekstensi) = Nama Mahasiswa.
 *    - Ini memungkinkan ZIP campuran (PDF lepas & Folder berisi Gambar) diproses bersamaan.
 * 
 * @param files - File mentah dari input (bisa campuran file lepas dan ZIP).
 * @returns Promise array StudentSubmission (Nama + Array File).
 */
export const processClassFiles = async (files: File[]): Promise<StudentSubmission[]> => {
    const submissions: Map<string, File[]> = new Map();

    for (const file of files) {
        const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip');
        
        if (isZip) {
            try {
                const entries = await extractFilesFromZipWithPaths(file);
                
                // --- LOGIKA COMMON ROOT DETECTION ---
                const allPaths = entries.map(e => e.path.split('/'));
                let commonDepth = 0;
                
                if (allPaths.length > 0) {
                    const minLength = Math.min(...allPaths.map(p => p.length));
                    for (let i = 0; i < minLength - 1; i++) {
                        const first = allPaths[0][i];
                        const isCommon = allPaths.every(p => p[i] === first);
                        if (isCommon) {
                            commonDepth++;
                        } else {
                            break;
                        }
                    }
                }
                // ------------------------------------

                for (const entry of entries) {
                    const parts = entry.path.split('/');
                    const meaningfulParts = parts.slice(commonDepth);
                    
                    let studentName = "";
                    
                    if (meaningfulParts.length > 1) {
                        // KASUS 1: Struktur Folder (misal: "NamaSiswa/File.jpg")
                        studentName = meaningfulParts[0]; 
                    } else {
                        // KASUS 2: File Datar (misal: "NamaSiswa.pdf")
                        const fileName = meaningfulParts[0];
                        // Hapus ekstensi file agar nama terlihat bersih (misal: "Budi.pdf" -> "Budi")
                        // Ini membuatnya konsisten dengan nama yang berasal dari Folder.
                        studentName = fileName.replace(/\.[^/.]+$/, "");
                    }

                    // Fallback
                    if (!studentName) studentName = entry.file.name;

                    if (!submissions.has(studentName)) {
                        submissions.set(studentName, []);
                    }
                    submissions.get(studentName)?.push(entry.file);
                }
            } catch (e) {
                console.warn(`Gagal ekstrak zip ${file.name}`, e);
            }
        } else {
            // KASUS 3: Upload Massal Non-ZIP
            // Gunakan nama file, hapus ekstensi untuk kebersihan
            const studentName = file.name.replace(/\.[^/.]+$/, "");
            
            let processedFile = file;
            if (!file.type || file.type === 'application/octet-stream') {
                const fixedType = getMimeTypeFromFilename(file.name);
                if (fixedType !== 'application/octet-stream') {
                    processedFile = new File([file], file.name, { type: fixedType });
                }
            }

            if (!submissions.has(studentName)) {
                submissions.set(studentName, []);
            }
            submissions.get(studentName)?.push(processedFile);
        }
    }

    return Array.from(submissions.entries()).map(([name, files]) => ({
        name,
        files
    }));
};

/**
 * Logika standar untuk Mode Individu (Flatten semua jadi satu).
 */
export const processUploadedFiles = async (files: File[]): Promise<File[]> => {
    const processedFiles: File[] = [];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')) {
            try {
                const unzippedFiles = await extractFilesFromZip(file);
                processedFiles.push(...unzippedFiles);
            } catch (e) {
                console.warn(`Could not unzip ${file.name}, skipping.`, e);
            }
        } else {
            if (!file.type || file.type === 'application/octet-stream') {
                const fixedType = getMimeTypeFromFilename(file.name);
                if (fixedType !== 'application/octet-stream') {
                    processedFiles.push(new File([file], file.name, { type: fixedType }));
                    continue;
                }
            }
            processedFiles.push(file);
        }
    }
    return processedFiles;
};
