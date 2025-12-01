
/**
 * @file officeFileUtils.ts
 * @description Utilitas untuk mengekstrak konten teks mentah dari file Microsoft Office.
 * Hal ini memungkinkan AI untuk menilai dokumen Word/Excel/PPT secara langsung dengan membaca teksnya,
 * alih-alih mengandalkan OCR visual, memastikan akurasi 100% untuk dokumen digital.
 */

import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';

/**
 * Helper: Membaca objek File dan mengembalikan kontennya sebagai ArrayBuffer.
 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Mengekstrak konten teks mentah dari file .docx (Word).
 * Menggunakan 'mammoth.js' untuk mengurai struktur XML dari dokumen Word.
 * @param file - File .docx.
 * @returns String teks dari body dokumen.
 */
const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

/**
 * Mengekstrak konten teks dari semua sheet file .xlsx (Excel).
 * Menggunakan 'xlsx' (SheetJS) untuk mengurai workbook.
 * @param file - File .xlsx.
 * @returns String gabungan: "Sheet: Name \n Content \n\n"
 */
const extractTextFromXlsx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        // Konversi data sheet ke format teks sederhana
        const text = xlsx.utils.sheet_to_txt(worksheet);
        fullText += `Sheet: ${sheetName}\n${text}\n\n`;
    });
    return fullText;
};

/**
 * Mengekstrak konten teks dari semua slide file .pptx (PowerPoint).
 * TEKNIK: File PPTX sebenarnya adalah ZIP dari file XML. 
 * Fungsi ini membuka zip pptx, menemukan semua file 'slideX.xml', 
 * dan mengurainya untuk menemukan tag <a:t> (teks).
 * 
 * @param file - File .pptx.
 * @returns Teks gabungan dari semua slide.
 */
const extractTextFromPptx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slidePromises: Promise<string>[] = [];
    
    // Temukan semua file slide (misalnya, ppt/slides/slide1.xml)
    zip.folder('ppt/slides')?.forEach((relativePath, file) => {
        if (relativePath.startsWith('slide') && relativePath.endsWith('.xml')) {
            slidePromises.push(file.async('string'));
        }
    });

    const slideXmls = await Promise.all(slidePromises);
    let fullText = '';

    // Regex untuk mengekstrak teks dari tag <a:t> dalam struktur XML slide
    const textContentRegex = /<a:t.*?>(.*?)<\/a:t>/g;

    slideXmls.forEach((xml, index) => {
        fullText += `--- Slide ${index + 1} ---\n`;
        let match;
        // Gunakan Set untuk menghindari blok teks duplikat (umum dalam struktur XML PPTX)
        const uniqueText = new Set<string>();
        while ((match = textContentRegex.exec(xml)) !== null) {
            uniqueText.add(match[1].trim());
        }
        fullText += Array.from(uniqueText).join('\n') + '\n\n';
    });

    return fullText;
};


/**
 * Fungsi dispatcher utama untuk mengekstrak teks dari tipe file Office yang didukung.
 * @param file - File Office.
 * @returns Promise yang diselesaikan dengan teks yang diekstrak.
 */
export const extractTextFromOfficeFile = async (file: File): Promise<string> => {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return extractTextFromDocx(file);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return extractTextFromXlsx(file);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return extractTextFromPptx(file);
    }
    return Promise.reject(new Error('Unsupported Office file type for text extraction.'));
};
