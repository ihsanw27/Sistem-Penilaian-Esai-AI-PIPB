/**
 * @file fileUtils.ts
 * @description Utilitas inti untuk manajemen file, ekstraksi arsip (ZIP), dan deteksi tipe MIME.
 * File ini berisi logika "Smart Heuristic" untuk menentukan cara pengelompokan file mahasiswa
 * dari struktur folder yang tidak terduga.
 * 
 * @module FileUtils
 */

import JSZip from 'jszip';
import { StudentSubmission } from '../types';

/**
 * Mendapatkan tipe MIME yang valid berdasarkan ekstensi file.
 * Digunakan untuk memperbaiki file yang terdeteksi sebagai 'application/octet-stream'.
 * 
 * @param {string} filename - Nama file lengkap.
 * @returns {string} Tipe MIME IANA standar.
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
 * Mengonversi objek File ke string Base64 murni (tanpa prefix data URI).
 * Diperlukan untuk mengirim payload gambar/dokumen ke Gemini API.
 * 
 * @param {File} file - Objek File browser.
 * @returns {Promise<string>} String Base64.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Hapus prefix "data:image/png;base64,"
        resolve(reader.result.split(',')[1]); 
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Memvalidasi entri ZIP untuk mengabaikan file sampah sistem (macOS __MACOSX, hidden files).
 */
const isValidZipEntry = (relativePath: string, entry: any) => {
    return !(entry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('/.') || relativePath.startsWith('.'));
};

/**
 * Membuat objek File baru dari Blob dengan tipe MIME yang diperbaiki.
 */
const createFileFromBlob = (blob: Blob, fileName: string) => {
    let mimeType = blob.type;
    // Jika browser gagal mendeteksi atau memberikan octet-stream, coba deteksi dari ekstensi nama file
    if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = getMimeTypeFromFilename(fileName);
    }
    return new File([blob], fileName, { type: mimeType });
};

/**
 * Mengekstrak file dari ZIP (Mode Datar/Flat).
 * Semua struktur folder diabaikan, file dikumpulkan jadi satu list.
 * Digunakan untuk: Mode Individu (Merging) atau Upload Kunci Dosen.
 * 
 * @param {File} zipFile - File ZIP sumber.
 * @returns {Promise<File[]>} Array file yang diekstrak.
 */
export const extractFilesFromZip = async (zipFile: File): Promise<File[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extractedFiles: File[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            const entry = fileEntry as any;
            if (!isValidZipEntry(relativePath, entry)) continue;

            const blob = await entry.async('blob');
            // Ambil nama file saja, abaikan folder path
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
 * Interface internal untuk menyimpan file beserta path aslinya di dalam ZIP.
 */
interface FileWithRelPath {
    file: File;
    path: string;
}

/**
 * Mengekstrak file dari ZIP dengan mempertahankan path strukturnya.
 * 
 * CRITICAL DEEP FIX FOR OCR CONSISTENCY:
 * Fungsi ini menerapkan "Nuclear Cache Busting".
 * Browser sering melakukan caching pada Blob/File jika nama filenya sama (misal 'page1.jpg').
 * 
 * Di sini, setiap file yang diekstrak diberi nama unik dengan Timestamp + Random Hash.
 * Ini MEMAKSA browser dan AI Service untuk memperlakukan setiap file sebagai objek baru yang unik,
 * mencegah data mahasiswa A terbaca sebagai mahasiswa B.
 * 
 * CATATAN KEAMANAN LOGIKA:
 * Pengubahan nama file fisik di sini TIDAK MERUSAK logika pengelompokan folder (Grouping).
 * Kita menyimpan 'path' (original) secara terpisah dari 'file' (fisik). 
 * Logika grouping menggunakan 'path', sedangkan AI membaca 'file'.
 * 
 * @param {File} zipFile - File ZIP sumber.
 * @returns {Promise<FileWithRelPath[]>} Array file dengan metadata path.
 */
export const extractFilesFromZipWithPaths = async (zipFile: File): Promise<FileWithRelPath[]> => {
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const extracted: FileWithRelPath[] = [];

        for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
            const entry = fileEntry as any;
            if (!isValidZipEntry(relativePath, entry)) continue;

            const blob = await entry.async('blob');
            
            // UNIQUE NAMING STRATEGY (CACHE BUSTING)
            // Format: "Path_Filename_TIMESTAMP_RANDOM.ext"
            // Mengganti slash '/' dengan underscore '_' dan menambah entropy SEBELUM ekstensi.
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            
            const sanitizedPath = relativePath.replace(/\//g, '_');
            
            // Sisipkan random string SEBELUM ekstensi agar MIME type tetap terbaca benar
            const lastDotIndex = sanitizedPath.lastIndexOf('.');
            let uniqueFileName;
            
            if (lastDotIndex !== -1) {
                const namePart = sanitizedPath.substring(0, lastDotIndex);
                const extPart = sanitizedPath.substring(lastDotIndex); // .jpg
                uniqueFileName = `${namePart}_${timestamp}_${randomSuffix}${extPart}`;
            } else {
                uniqueFileName = `${sanitizedPath}_${timestamp}_${randomSuffix}`;
            }
            
            // File fisik ini yang akan dikirim ke AI
            // createFileFromBlob akan menggunakan ekstensi di akhir uniqueFileName untuk memperbaiki MIME type
            const file = createFileFromBlob(blob, uniqueFileName);
            
            // Simpan path asli untuk keperluan grouping logika
            extracted.push({ file, path: relativePath });
        }
        return extracted;
    } catch (error) {
         console.error("Error unzipping file with paths:", error);
         throw new Error(`Gagal mengekstrak file ZIP: ${zipFile.name}`);
    }
};

/**
 * Memproses file upload untuk Mode Kelas dengan logika pengelompokan DETERMINISTIK (v4.0).
 * 
 * LOGIKA DETEKSI BARU:
 * 1. **Common Root Stripping**: Membuang folder induk jika semua file ada di dalamnya.
 * 2. **Analisis Tipe ZIP**:
 *    - Jika ZIP berisi campuran folder dan file, atau hanya dokumen (PDF/Doc) -> Mode Kelas Campuran.
 *    - Jika ZIP HANYA berisi gambar di root level -> Mode Individu (1 Mahasiswa = 1 ZIP).
 * 3. **Pengelompokan (Grouping)**:
 *    - **Folder**: File dalam folder "Budi/" -> Mahasiswa "Budi".
 *    - **File Root**: File "Ani.pdf" di root -> Mahasiswa "Ani" (ekstensi dibuang).
 * 
 * @param {File[]} files - Array file mentah dari input elemen.
 * @returns {Promise<StudentSubmission[]>} Data terstruktur siap nilai.
 */
export const processClassFiles = async (files: File[]): Promise<StudentSubmission[]> => {
    const submissions: Map<string, File[]> = new Map();

    for (const file of files) {
        const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip');
        
        if (isZip) {
            try {
                const entries = await extractFilesFromZipWithPaths(file);
                if (entries.length === 0) continue;
                
                // --- 1. Deteksi Common Root (Folder Induk) ---
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

                // --- 2. Analisis Konten untuk Penentuan Mode ---
                // Cek apakah ZIP ini kemungkinan besar adalah scan tugas 1 orang (isinya cuma gambar)
                const rootLevelFolders = new Set<string>();
                let hasOnlyImagesAtRoot = true;

                entries.forEach(entry => {
                    const parts = entry.path.split('/').slice(commonDepth);
                    
                    if (parts.length > 1) {
                        // Ada folder
                        rootLevelFolders.add(parts[0]);
                        hasOnlyImagesAtRoot = false;
                    } else {
                        // File di root
                        const ext = parts[0].split('.').pop()?.toLowerCase();
                        if (!['jpg','jpeg','png','webp','heic'].includes(ext || '')) {
                            hasOnlyImagesAtRoot = false; // Ada PDF/Doc, berarti bukan sekadar kumpulan foto
                        }
                    }
                });

                // KASUS A: ZIP Individu (Hanya gambar, tidak ada folder lain)
                // Contoh: Upload "Tugas_Budi.zip" isinya [hal1.jpg, hal2.jpg]
                if (hasOnlyImagesAtRoot && rootLevelFolders.size === 0) {
                    const zipStudentName = file.name.replace(/\.[^/.]+$/, ""); // Nama ZIP jadi Nama Mhs
                    if (!submissions.has(zipStudentName)) {
                        submissions.set(zipStudentName, []);
                    }
                    entries.forEach(e => submissions.get(zipStudentName)?.push(e.file));
                    continue; // Lanjut ke file berikutnya
                }

                // KASUS B: ZIP Kelas (Campuran Folder / Dokumen)
                // Contoh: "KelasA.zip" isinya [FolderBudi/, FolderAni/, Siti.pdf]
                for (const entry of entries) {
                    const parts = entry.path.split('/').slice(commonDepth);
                    let studentName = "";

                    if (parts.length > 1) {
                        // STRATEGI FOLDER: Nama folder adalah nama mahasiswa
                        // "Budi/halaman1.jpg" -> "Budi"
                        studentName = parts[0]; 
                    } else {
                        // STRATEGI FILE: Nama file (tanpa ekstensi) adalah nama mahasiswa
                        // "Siti Aminah.pdf" -> "Siti Aminah"
                        studentName = parts[0].replace(/\.[^/.]+$/, "");
                    }

                    if (!studentName) continue;

                    if (!submissions.has(studentName)) {
                        submissions.set(studentName, []);
                    }
                    submissions.get(studentName)?.push(entry.file);
                }

            } catch (e) {
                console.warn(`Gagal ekstrak zip ${file.name}`, e);
            }
        } else {
            // KASUS NON-ZIP (Upload file biasa di Mode Kelas)
            // Setiap file dianggap 1 mahasiswa
            const studentName = file.name.replace(/\.[^/.]+$/, "");
            
            // Fix MIME type
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

    // Konversi Map ke Array untuk output
    return Array.from(submissions.entries()).map(([name, files]) => ({
        name,
        files
    }));
};

/**
 * Logika standar untuk Mode Individu (Flatten semua jadi satu).
 * Menggabungkan semua file input (termasuk isi ZIP) menjadi satu array datar.
 * 
 * @param {File[]} files - File input.
 * @returns {Promise<File[]>} Array file flat.
 */
export const processUploadedFiles = async (files: File[]): Promise<File[]> => {
    const processedFiles: File[] = [];

    for (const file of files) {
        if (file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')) {
            try {
                // Gunakan versi flat (tanpa path handling) untuk individu
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