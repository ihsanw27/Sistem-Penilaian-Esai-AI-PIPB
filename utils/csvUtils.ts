
/**
 * @file csvUtils.ts
 * @description Utilitas untuk menghasilkan dan mengunduh laporan.
 * Meskipun bernama 'csvUtils', file ini sekarang menghasilkan file Excel Multi-Sheet (.xlsx) tingkat lanjut.
 */

import { GradeResult } from '../types';
import * as XLSX from 'xlsx';

/**
 * Menghasilkan workbook Excel dengan dua sheet spesifik:
 * 1. "Rekap Nilai" (Ringkasan): Satu baris per siswa, berisi nilai akhir dan saran utama.
 * 2. "Analisis Per Soal" (Detail): Satu baris per PERTANYAAN per siswa. Berisi analisis granular.
 * 
 * @param results - Array hasil penilaian dari Mode Kelas.
 * @returns Objek Workbook XLSX.
 */
export function generateCsv(results: GradeResult[]): any {
    // --- Sheet 1: Ringkasan ---
    const summaryData = results.map(res => ({
        'Nama File': res.fileName || 'N/A',
        'Nilai Akhir': res.grade,
        'Saran Perbaikan': res.improvements
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);

    // --- Sheet 2: Analisis Detail ---
    const detailedData: any[] = [];
    results.forEach(res => {
        res.detailedFeedback.forEach(fb => {
            // Ratakan struktur bersarang untuk representasi tabular
            detailedData.push({
                'Nama File': res.fileName || 'N/A',
                'Nomor Soal': fb.questionNumber,
                'Teks Soal (Dosen)': fb.questionText || '',
                'Kunci Jawaban (Dosen)': fb.lecturerAnswer || '',
                'Jawaban Siswa (OCR)': fb.studentAnswer || '',
                'Skor Soal': fb.score,
                'Umpan Balik AI': fb.feedback
            });
        });
    });
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData);

    // Buat Workbook dan lampirkan sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Rekap Nilai");
    XLSX.utils.book_append_sheet(workbook, detailedSheet, "Analisis Per Soal");

    return workbook;
}

/**
 * Memicu unduhan browser untuk workbook Excel yang dihasilkan.
 * @param workbook - Objek workbook XLSX.
 * @param fileName - Nama file yang diinginkan untuk file yang diunduh.
 */
export function downloadCsv(workbook: any, fileName: string) {
    // Pastikan ekstensi .xlsx
    const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(workbook, fullFileName);
}
