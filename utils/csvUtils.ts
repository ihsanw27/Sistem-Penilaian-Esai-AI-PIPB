
import { GradeResult } from '../types';
import * as XLSX from 'xlsx';

/**
 * Generates an Excel file with multiple sheets from an array of GradeResult objects.
 * Sheet 1: Summary (Name, Final Grade, Improvements)
 * Sheet 2: Detailed Analysis (Name, Q#, Question Text, Student Answer, Score, Feedback)
 * @param results - An array of grading results.
 */
export function generateCsv(results: GradeResult[]): any {
    // --- Sheet 1: Summary ---
    const summaryData = results.map(res => ({
        'Nama File': res.fileName || 'N/A',
        'Nilai Akhir': res.grade,
        'Saran Perbaikan': res.improvements
    }));
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);

    // --- Sheet 2: Detailed Analysis ---
    const detailedData: any[] = [];
    results.forEach(res => {
        res.detailedFeedback.forEach(fb => {
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

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Rekap Nilai");
    XLSX.utils.book_append_sheet(workbook, detailedSheet, "Analisis Per Soal");

    return workbook;
}

/**
 * Triggers a browser download for the generated Excel workbook.
 * @param workbook - The XLSX workbook object.
 * @param fileName - The desired name for the downloaded file.
 */
export function downloadCsv(workbook: any, fileName: string) {
    // Use .xlsx extension
    const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(workbook, fullFileName);
}
