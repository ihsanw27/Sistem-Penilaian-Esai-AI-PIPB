
/**
 * @file fileUtils.ts
 * @description Menyediakan utilitas untuk operasi file, khususnya:
 * 1. Konversi Base64 untuk upload API.
 * 2. Ekstraksi ZIP (Unzipping) untuk upload batch/massal.
 * 3. Inferensi tipe MIME cerdas (memperbaiki masalah 'application/octet-stream').
 */

import JSZip from 'jszip';

/**
 * Pembantu untuk menyimpulkan tipe mime dari ekstensi nama file.
 * Penting untuk file yang diekstrak dari ZIP di mana metadata tipe MIME sering hilang
 * atau default ke 'application/octet-stream', yang ditolak API.
 * 
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
 * Ini diperlukan untuk mengirim data gambar/PDF ke Gemini melalui field `inlineData`.
 * 
 * @param file - Objek File yang akan dikonversi.
 * @returns Promise yang diselesaikan dengan string base64 (tanpa prefix data URL).
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Kita menghapus prefix "data:image/png;base64," untuk mendapatkan raw bytes
        resolve(reader.result.split(',')[1]); 
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Mengekstrak file dari arsip ZIP secara rekursif (secara konseptual).
 * Fungsi ini mengabaikan direktori dan file sistem tersembunyi (seperti __MACOSX) untuk menjaga daftar tetap bersih.
 * Juga secara otomatis memperbaiki tipe MIME untuk file yang diekstrak.
 * 
 * @param zipFile - File .zip.
 * @returns Promise yang menyelesaikan ke array objek File yang diekstrak dari zip.
 */
export const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extractedFiles: File[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            // Cast ke any untuk menangani masalah inferensi tipe dengan JSZip
            const entry = fileEntry as any;
            
            // Lewati direktori dan file resource fork MacOS tersembunyi
            if (entry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('/.') || relativePath.startsWith('.')) {
                continue;
            }

            const blob = await entry.async('blob');
            // Tangani folder bersarang dengan mengambil basename (hanya nama file)
            const fileName = relativePath.split('/').pop() || relativePath;
            
            // Perbaikan: Tentukan secara eksplisit tipe MIME dari ekstensi jika tipe blob generik
            let mimeType = blob.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
                mimeType = getMimeTypeFromFilename(fileName);
            }
            
            // Buat objek File browser baru dengan tipe MIME yang benar
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
 * Titik masuk utama untuk penanganan file di UI.
 * Memproses daftar file mentah yang diunggah. 
 * Jika menemukan ZIP, fungsi ini mengekstrak isinya dan meratakan (flatten) hasilnya ke dalam array utama.
 * 
 * @param files - Array file dari elemen input HTML.
 * @returns Promise yang menyelesaikan ke array datar file yang diproses, siap untuk API.
 */
export const processUploadedFiles = async (files: File[]): Promise<File[]> => {
    const processedFiles: File[] = [];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
            try {
                // Jika ZIP, ekstrak isi dan tambahkan ke daftar
                const unzippedFiles = await extractFilesFromZip(file);
                processedFiles.push(...unzippedFiles);
            } catch (e) {
                console.warn(`Could not unzip ${file.name}, skipping.`, e);
            }
        } else {
            // Tangani file reguler: periksa apakah kita perlu memperbaiki tipe MIME
            if (!file.type || file.type === 'application/octet-stream') {
                const fixedType = getMimeTypeFromFilename(file.name);
                if (fixedType !== 'application/octet-stream') {
                    // Buat ulang file dengan tipe yang benar
                    processedFiles.push(new File([file], file.name, { type: fixedType }));
                    continue;
                }
            }
            processedFiles.push(file);
        }
    }
    return processedFiles;
};
