
/**
 * @file ClassMode.tsx
 * @description Komponen Penilaian Batch (Mode Kelas).
 * Komponen ini menangani logika kompleks penilaian banyak file secara bersamaan (concurrently).
 * 
 * FITUR UTAMA:
 * - Worker Pool Concurrency: Menilai 5 file/submission sekaligus untuk mengoptimalkan throughput.
 * - Staggered Start: Peluncuran bertahap untuk mencegah error "Thundering Herd" pada API.
 * - Safety Timeout: Mencegah kemacetan tak terbatas pada satu file yang lambat.
 * - Folder-based Grouping: Mendukung pengelompokan file dalam ZIP berdasarkan folder (1 Folder = 1 Mahasiswa).
 * - Manifest Preview: Fitur untuk melihat daftar mahasiswa terdeteksi sebelum proses dimulai.
 * - Ekspor Multi-Sheet: Menghasilkan laporan Excel yang mendetail.
 * - Visualisasi: Histogram Distribusi Nilai dan Statistik Kelas.
 * 
 * @author System
 * @version 1.6.0
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { fileToBase64, processUploadedFiles, processClassFiles } from '../utils/fileUtils';
import { gradeAnswer } from '../services/geminiService';
import { GradeResult, StudentSubmission } from '../types';
import { UploadIcon, PaperclipIcon, DownloadIcon, XIcon, CheckIcon, ClipboardIcon } from './icons';
import { extractTextFromOfficeFile } from '../utils/officeFileUtils';
import { generateCsv, downloadCsv } from '../utils/csvUtils';

// SAFETY TIMEOUT: 15 Menit. 
const SAFETY_TIMEOUT_MS = 15 * 60 * 1000; 

interface ClassModeProps {
    /** Callback untuk memberi tahu parent (Dashboard) jika ada data aktif (file/hasil) */
    onDataDirty?: (isDirty: boolean) => void;
}

const ClassMode: React.FC<ClassModeProps> = ({ onDataDirty }) => {
    // --- MANAJEMEN STATE ---

    // Input Data: Menggunakan 'submissions' (Nama + Array File) alih-alih file datar.
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    
    // Kunci Jawaban Dosen
    const [lecturerFiles, setLecturerFiles] = useState<File[]>([]);
    const [lecturerAnswerText, setLecturerAnswerText] = useState<string>('');
    const [answerKeyInputMethod, setAnswerKeyInputMethod] = useState<'file' | 'text'>('file');
    const [keepLecturerAnswer, setKeepLecturerAnswer] = useState<boolean>(true);

    // Hasil & Status Pemrosesan
    const [results, setResults] = useState<GradeResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [elapsedTime, setElapsedTime] = useState(0);

    // Modal & UI State
    const [selectedResult, setSelectedResult] = useState<GradeResult | null>(null);
    const [showOcr, setShowOcr] = useState(false);
    const [showPreview, setShowPreview] = useState<boolean>(false); // State untuk Manifest Preview
    const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set()); // State untuk row yang di-expand di preview
    
    // Deteksi Duplikasi
    const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
    const [showDuplicateWarning, setShowDuplicateWarning] = useState<boolean>(false);

    // Konfigurasi Sorting Tabel
    const [sortConfig, setSortConfig] = useState<{ key: 'fileName' | 'grade'; direction: 'asc' | 'desc' }>({ 
        key: 'fileName', 
        direction: 'asc' 
    });

    // Manajemen Pembatalan (Cancellation)
    const [activeJobCancellers, setActiveJobCancellers] = useState<Record<string, () => void>>({});
    const abortBatchRef = useRef<boolean>(false);
    
    const acceptedFileTypes = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed";
    
    // Effect: Melaporkan "Dirty State" ke parent
    useEffect(() => {
        if (onDataDirty) {
            const isDirty = submissions.length > 0 || results.length > 0;
            onDataDirty(isDirty);
        }
    }, [submissions, results, onDataDirty]);

    // Effect: Logika Timer selama loading
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isLoading) {
            setElapsedTime(0);
            timer = setInterval(() => {
                setElapsedTime(prevTime => prevTime + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isLoading]);


    // Memo: Hitung Statistik
    const stats = useMemo(() => {
        const validResults = results.filter(r => 
            !r.improvements?.includes("GAGAL") && 
            !r.studentText?.includes("Proses dibatalkan")
        );

        if (validResults.length === 0) {
            return { highest: 0, lowest: 0, average: 0, count: 0, distribution: [] };
        }
        
        const grades = validResults.map(r => r.grade);
        const highest = Math.max(...grades);
        const lowest = Math.min(...grades);
        const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
        
        const distribution = Array(10).fill(0);
        grades.forEach(g => {
            const idx = Math.min(Math.floor(g / 10), 9);
            distribution[idx]++;
        });

        return { highest, lowest, average, count: validResults.length, distribution };
    }, [results]);

    // Handler Logika Sorting
    const handleSort = (key: 'fileName' | 'grade') => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Memo: Hasil yang difilter & disortir
    const sortedResults = useMemo(() => {
        const sorted = [...results].sort((a, b) => {
            const nameA = a.fileName || '';
            const nameB = b.fileName || '';

            if (sortConfig.key === 'fileName') {
                return sortConfig.direction === 'asc' 
                    ? nameA.localeCompare(nameB, undefined, { numeric: true })
                    : nameB.localeCompare(nameA, undefined, { numeric: true });
            } else {
                return sortConfig.direction === 'asc' 
                    ? a.grade - b.grade 
                    : b.grade - a.grade;
            }
        });
        return sorted;
    }, [results, sortConfig]);

    // Helper: Warna Nilai
    const getGradeColor = (grade: number) => {
        if (grade >= 75) return 'text-green-600 dark:text-green-400';
        if (grade >= 61) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getBarColor = (binIndex: number) => {
        const startVal = binIndex * 10;
        if (startVal >= 70) return 'bg-green-400 dark:bg-green-500';
        if (startVal >= 60) return 'bg-yellow-400 dark:bg-yellow-500';
        return 'bg-red-400 dark:bg-red-500';
    };

    // Helper: Membersihkan nama file untuk tampilan (menghapus cache-busting suffix)
    // dan mengganti underscore dengan slash untuk visualisasi path.
    const getDisplayFilename = (filename: string) => {
        // 1. Hapus cache buster (underscore + 13 digit + underscore + 6 alfanum)
        // Pola regex: _\d{13}_[a-z0-9]{6}
        let clean = filename.replace(/_\d{13}_[a-z0-9]{6}/, '');
        
        // 2. Ganti underscore sisa dengan slash agar terlihat seperti path folder
        // Ini memberikan visualisasi hierarki yang lebih baik (misal: Folder/File.jpg)
        return clean.replace(/_/g, '/');
    };

    // --- HANDLER PENANGANAN FILE ---
    
    // Handler input Mahasiswa (Mode Kelas)
    const handleStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            // Bersihkan state lama sepenuhnya
            setSubmissions([]);
            setResults([]);
            setDuplicateNames([]);
            setExpandedPreviews(new Set());
            setShowDuplicateWarning(false);
            setShowPreview(true); // Otomatis buka preview agar user sadar datanya

            const rawFiles = Array.from(files) as File[];
            // Gunakan processClassFiles untuk mendukung grouping Folder ZIP
            const processedSubmissions = await processClassFiles(rawFiles);
            setSubmissions(processedSubmissions);
        }
    };
    
    // Handler input Dosen (Tetap Flatten, semua jadi satu referensi)
    const handleLecturerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const rawFiles = Array.from(files) as File[];
            const processed = await processUploadedFiles(rawFiles);
            setLecturerFiles(processed);
        }
    };
    
    const handleAnswerKeyMethodChange = (method: 'file' | 'text') => {
        setAnswerKeyInputMethod(method);
        if (method === 'file') setLecturerAnswerText('');
        else setLecturerFiles([]);
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setLecturerAnswerText(prev => prev + text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            setError('Gagal membaca dari clipboard. Pastikan izin browser diberikan.');
        }
    };

    // Handler Expand/Collapse Preview Row
    const togglePreviewExpand = (name: string) => {
        const newSet = new Set(expandedPreviews);
        if (newSet.has(name)) {
            newSet.delete(name);
        } else {
            newSet.add(name);
        }
        setExpandedPreviews(newSet);
    };

    /**
     * Mengonversi file mentah menjadi bagian konten siap API.
     */
    const processFilesToParts = useCallback(async (files: File[]) => {
        return Promise.all(
            files.map(async (file) => {
                const officeMimeTypes = [
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ];
                if (officeMimeTypes.includes(file.type)) {
                    const text = await extractTextFromOfficeFile(file).catch(() => `Error processing ${file.name}`);
                    return { text: `--- Start of file: ${file.name} ---\n${text}\n--- End of file: ${file.name} ---` };
                } else {
                    const base64 = await fileToBase64(file);
                    return { inlineData: { data: base64, mimeType: file.type } };
                }
            })
        );
    }, []);

    // --- HANDLER KONTROL JOB ---

    const handleManualSkip = (name: string) => {
        const cancel = activeJobCancellers[name];
        if (typeof cancel === 'function') {
            cancel(); 
        }
    };
    
    const handleCancelBatch = () => {
        abortBatchRef.current = true;
        Object.values(activeJobCancellers).forEach((cancelFunc) => {
            if (typeof cancelFunc === 'function') {
                cancelFunc();
            }
        });
        setIsLoading(false);
        setProgress(prev => ({ ...prev, message: 'Proses dibatalkan oleh pengguna.' }));
    };

    const handleResetAll = () => {
        setResults([]);
        setSubmissions([]);
        setError(null);
        setProgress({ current: 0, total: 0, message: '' });
        setShowPreview(false);
        setExpandedPreviews(new Set());
    };

    /**
     * LOGIKA PENILAIAN (SATU SUBMISSION).
     * Submission bisa berisi 1 file atau banyak file (dari folder).
     */
    const gradeSubmission = useCallback(async (
        submission: StudentSubmission,
        lecturerAnswerPayload: any
    ): Promise<GradeResult | null> => {
        // Critical: Pastikan kita menggunakan 'submission' yang diteruskan sebagai argumen,
        // BUKAN variabel dari closure yang mungkin basi.
        const currentSubmissionName = submission.name;

        const gradingPromise = async () => {
            try {
                // Proses semua file dalam submission ini menjadi parts
                // Fix: Pastikan file yang diproses benar-benar milik submission ini
                const studentFileParts = await processFilesToParts(submission.files);
                
                const gradingResult = await gradeAnswer(studentFileParts, lecturerAnswerPayload);
                
                if (gradingResult) {
                    return { ...gradingResult, fileName: currentSubmissionName };
                }
                return null;
            } catch (e) {
                console.error(`Failed to grade ${currentSubmissionName}:`, e);
                throw e;
            }
        };

        let cancel: () => void = () => {}; 
        const racePromise = new Promise<GradeResult | null>((_, reject) => {
            cancel = () => reject(new Error('Dibatalkan Manual atau Timeout'));
            const timer = setTimeout(() => {
                reject(new Error('Timeout (Batas Waktu Habis)'));
            }, SAFETY_TIMEOUT_MS);
            setActiveJobCancellers(prev => ({ ...prev, [currentSubmissionName]: cancel }));
        });

        try {
            const result = await Promise.race([gradingPromise(), racePromise]);
            setActiveJobCancellers(prev => {
                const newState = { ...prev };
                delete newState[currentSubmissionName];
                return newState;
            });
            return result;
        } catch (error: any) {
            setActiveJobCancellers(prev => {
                const newState = { ...prev };
                delete newState[currentSubmissionName];
                return newState;
            });
            return {
                fileName: currentSubmissionName,
                grade: 0,
                detailedFeedback: [],
                improvements: `GAGAL: ${error.message}. Silakan nilai file ini secara manual.`,
                studentText: "Proses dibatalkan atau waktu habis."
            };
        }
    }, [processFilesToParts]);

    /**
     * Pemeriksaan Deteksi Duplikasi
     */
    const handleStartCheck = () => {
        const names = submissions.map(s => s.name);
        const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
        const uniqueDuplicates = [...new Set(duplicates)];

        if (uniqueDuplicates.length > 0) {
            setDuplicateNames(uniqueDuplicates);
            setShowDuplicateWarning(true);
        } else {
            handleSubmit();
        }
    };

    /**
     * LOGIKA PEMROSESAN BATCH UTAMA
     */
    const handleSubmit = useCallback(async () => {
        setShowDuplicateWarning(false);
        // Otomatis tutup preview saat mulai agar tampilan bersih
        setShowPreview(false);
        setExpandedPreviews(new Set());
        
        const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());
        if (submissions.length === 0 || isLecturerInputMissing) {
            setError("Harap unggah file jawaban mahasiswa dan berikan kunci jawaban dosen.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResults([]);
        setActiveJobCancellers({});
        abortBatchRef.current = false;
        
        const concurrencyLimit = 5;
        const totalSteps = submissions.length;
        setProgress({ current: 0, total: totalSteps, message: `Menginisialisasi antrian cerdas...` });

        try {
            const lecturerAnswerPayload: { parts?: any[], text?: string } = {};
            if (answerKeyInputMethod === 'file') {
                 lecturerAnswerPayload.parts = await processFilesToParts(lecturerFiles);
            } else {
                lecturerAnswerPayload.text = lecturerAnswerText;
            }

            // Menggunakan atomic counter (ref) untuk indeks, memastikan thread-safety dalam JS event loop
            const indexRef = { current: 0 };
            const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

            const worker = async (workerId: number) => {
                while (indexRef.current < submissions.length) {
                    if (abortBatchRef.current) break;

                    // Atomic capture of index and increment
                    const i = indexRef.current++;
                    
                    if (i >= submissions.length) break;

                    const submission = submissions[i];

                    const result = await gradeSubmission(submission, lecturerAnswerPayload);

                    if (abortBatchRef.current) break;

                    if (result) {
                        setResults(prev => [...prev, result]);
                    }

                    setProgress(prev => ({
                        ...prev,
                        current: Math.min(prev.current + 1, totalSteps),
                        message: `Menganalisis berkas... (${Math.min(prev.current + 1, totalSteps)}/${totalSteps})`
                    }));

                    // Random Jitter wait between jobs to prevent rate limit hammering
                    if (indexRef.current < submissions.length) {
                        await sleep(1000 + Math.random() * 2000);
                    }
                }
            };

            const workers = [];
            for (let w = 0; w < concurrencyLimit; w++) {
                workers.push(worker(w));
                // Staggered start to prevent thundering herd
                await sleep(800); 
            }

            await Promise.all(workers);
            
            if (!abortBatchRef.current) {
                setProgress(p => ({ ...p, current: p.total, message: 'Analisis Selesai' }));
                setSubmissions([]); 
                if (!keepLecturerAnswer) {
                    setLecturerFiles([]);
                    setLecturerAnswerText('');
                }
            }
        } catch (err) {
            if (!abortBatchRef.current) {
                setError("Terjadi kesalahan tak terduga selama proses penilaian.");
                console.error(err);
            }
        } finally {
            if (!abortBatchRef.current) {
                setIsLoading(false);
            }
            setActiveJobCancellers({});
        }
    }, [submissions, lecturerFiles, answerKeyInputMethod, lecturerAnswerText, gradeSubmission, keepLecturerAnswer, processFilesToParts]);
    
    const handleDownload = () => {
        const workbook = generateCsv(sortedResults);
        downloadCsv(workbook, 'Hasil-Penilaian-Kelas-PIPB.xlsx');
    };

    const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());
    const activeNames = Object.keys(activeJobCancellers);
    const maxDistribution = Math.max(...stats.distribution, 1);

    const SortIcon = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
        if (!active) {
            return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>;
        }
        return direction === 'asc' 
            ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* --- PANEL INPUT (KIRI) --- */}
                <div className="space-y-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm transition-colors duration-200">
                     <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                         <span className="text-xl">📦</span> Langkah 1: Unggah Berkas Massal
                    </h2>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah Semua Jawaban Mahasiswa</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-blue-200 dark:border-blue-800 border-dashed rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="space-y-1 text-center">
                                {submissions.length === 0 ? (
                                    <>
                                        <UploadIcon className="mx-auto h-12 w-12 text-blue-400 dark:text-blue-500" />
                                        <label htmlFor="student-file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 pb-1">
                                            <span>Pilih File Kelas</span>
                                            <input id="student-file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                        </label>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400 font-medium">Mode Kelas: Deteksi Otomatis ZIP.</p>
                                            <p>• Jika file satuan: 1 File = 1 Mahasiswa</p>
                                            <p>• Jika ZIP berisi folder: 1 Folder = 1 Mahasiswa (Isi folder digabung)</p>
                                            <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <PaperclipIcon className="mx-auto h-12 w-12 text-blue-500" />
                                        <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">{submissions.length} Mahasiswa siap dinilai</p>
                                        <div className="flex justify-center items-center gap-3 mt-3">
                                            <label htmlFor="student-file-upload" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                Ganti
                                                <input id="student-file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                            </label>
                                            <button
                                                onClick={() => setSubmissions([])}
                                                className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                                            >
                                                Hapus Semua
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* FITUR BARU: Pratinjau Manifest Data (Sanity Check) */}
                        {submissions.length > 0 && (
                            <div className="mt-3">
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        👁️ {showPreview ? 'Sembunyikan' : 'Lihat'} Daftar {submissions.length} Mahasiswa Terdeteksi
                                    </span>
                                    <span className={`transform transition-transform ${showPreview ? 'rotate-180' : ''}`}>▼</span>
                                </button>
                                
                                {showPreview && (
                                    <div className="mt-2 p-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-inner max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase w-8">No</th>
                                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Nama Mahasiswa (ID)</th>
                                                    <th className="px-3 py-2 text-right text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Jml File</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {submissions.map((sub, i) => (
                                                    <React.Fragment key={i}>
                                                        <tr 
                                                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                                            onClick={() => togglePreviewExpand(sub.name)}
                                                        >
                                                            <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-500 font-mono align-top">{i + 1}</td>
                                                            <td className="px-3 py-1.5 text-xs text-gray-800 dark:text-gray-300 font-medium align-top">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`transform transition-transform text-[10px] text-gray-400 ${expandedPreviews.has(sub.name) ? 'rotate-90' : ''}`}>
                                                                        ▶
                                                                    </span>
                                                                    <span className="truncate max-w-[150px]" title={sub.name}>{sub.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-1.5 text-xs text-right text-gray-500 dark:text-gray-400 align-top">
                                                                <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                                                    {sub.files.length}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {/* Nested Row for File Details */}
                                                        {expandedPreviews.has(sub.name) && (
                                                            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                                                                <td colSpan={3} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                                                                    <div className="pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Rincian File:</p>
                                                                        <ul className="space-y-1">
                                                                            {sub.files.map((f, idx) => (
                                                                                <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                                                                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                                                    <span className="truncate max-w-[200px]" title={f.name}>
                                                                                        {/* Menampilkan nama file yang sudah dibersihkan dari kode unik (cache buster) */}
                                                                                        {getDisplayFilename(f.name)}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-gray-400 border border-gray-200 dark:border-gray-700 px-1 rounded">
                                                                                        {(f.size / 1024).toFixed(0)} KB
                                                                                    </span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-[10px] text-yellow-800 dark:text-yellow-400 border-t border-yellow-100 dark:border-yellow-900/30 text-center">
                                            💡 Klik nama mahasiswa untuk melihat rincian file di dalamnya.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4 mt-8 flex items-center gap-2">
                        <span className="text-xl">🔑</span> Langkah 2: Unggah Soal & Kunci Jawaban
                    </h2>
                    <div>
                        {/* Lecturer Input Section */}
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah Kunci Jawaban Dosen</label>
                         <div className="rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                             <div className="flex border-b border-gray-300 dark:border-gray-600">
                                <button onClick={() => handleAnswerKeyMethodChange('file')} className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${answerKeyInputMethod === 'file' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 dark:border-blue-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Unggah File</button>
                                <button onClick={() => handleAnswerKeyMethodChange('text')} className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${answerKeyInputMethod === 'text' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 dark:border-blue-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>Ketik Manual</button>
                            </div>
                             <div className="p-4 bg-white dark:bg-gray-800">
                                {answerKeyInputMethod === 'file' ? (
                                     <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-200 dark:border-gray-600 border-dashed rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <div className="space-y-1 text-center">
                                            {lecturerFiles.length === 0 ? (
                                                <>
                                                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                    <label htmlFor="lecturer-file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 pb-1">
                                                        <span>Pilih File Kunci</span>
                                                        <input id="lecturer-file-upload" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple/>
                                                    </label>
                                                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 space-y-1">
                                                        <p>Semua file (termasuk ZIP) akan digabung jadi satu referensi kunci.</p>
                                                        <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP.</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div>
                                                    <PaperclipIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">{lecturerFiles.length} file referensi dipilih</p>
                                                    <div className="flex justify-center items-center gap-3 mt-3">
                                                        <label htmlFor="lecturer-file-upload" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                            Ganti
                                                            <input id="lecturer-file-upload" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple />
                                                        </label>
                                                        <button
                                                            onClick={() => setLecturerFiles([])}
                                                            className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                                                        >
                                                            Hapus
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : ( 
                                    <div>
                                        <textarea
                                            rows={10}
                                            className="mt-1 block w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 p-3"
                                            placeholder="Contoh:&#10;1. Jelaskan prinsip kerja pompa sentrifugal?&#10;Jawaban: Prinsip kerjanya adalah mengubah energi kinetik...&#10;&#10;(Anda dapat menempelkan teks soal dan kunci jawaban lengkap di sini)"
                                            value={lecturerAnswerText} 
                                            onChange={(e) => setLecturerAnswerText(e.target.value)} 
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button
                                                onClick={handlePasteFromClipboard}
                                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                                            >
                                                <ClipboardIcon className="w-4 h-4 mr-2" />
                                                Tempel dari Clipboard
                                            </button>
                                            <button
                                                onClick={() => setLecturerAnswerText('')}
                                                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60"
                                            >
                                                Bersihkan
                                            </button>
                                        </div>
                                    </div>
                                )}
                             </div>
                        </div>
                        <div className="flex items-center pt-3 justify-start">
                            <div className="flex items-center">
                                <input
                                    id="keep-lecturer-answer-class"
                                    name="keep-lecturer-answer-class"
                                    type="checkbox"
                                    checked={keepLecturerAnswer}
                                    onChange={(e) => setKeepLecturerAnswer(e.target.checked)}
                                    className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                                />
                                <label htmlFor="keep-lecturer-answer-class" className="ml-2 block text-sm text-gray-600 dark:text-gray-400">
                                    Ingat kunci jawaban untuk penilaian berikutnya
                                </label>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <button
                            onClick={handleCancelBatch}
                            className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform active:scale-[0.98]"
                        >
                            Batalkan Proses
                        </button>
                    ) : (
                        <button 
                            onClick={handleStartCheck} 
                            disabled={submissions.length === 0 || isLecturerInputMissing} 
                            className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] dark:disabled:from-gray-600 dark:disabled:to-gray-600"
                        >
                             Mulai Penilaian AI untuk {submissions.length} Mahasiswa
                        </button>
                    )}
                </div>

                {/* --- PANEL HASIL (KANAN) --- */}
                 <div className="relative flex flex-col min-h-[500px] lg:min-h-0">
                    <div className={`p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-gray-700 shadow-md flex flex-col transition-all duration-500 ease-in-out w-full relative h-auto lg:absolute lg:inset-0 lg:overflow-y-auto custom-scrollbar`}>
                        {/* Header Hasil */}
                        {(results.length > 0 || isLoading) && (
                            <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 py-3 pt-5 pb-3 -mx-4 px-4 -mt-4 border-b border-gray-100 dark:border-gray-700 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span className="text-2xl">📊</span> Rekapitulasi Nilai Kelas
                                </h2>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    {results.length > 0 && !isLoading && (
                                        <>
                                            <button 
                                                onClick={handleResetAll}
                                                className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors w-full sm:w-auto"
                                            >
                                                <UploadIcon className="h-4 w-4 mr-2" />
                                                Mulai Penilaian Baru
                                            </button>
                                            <button 
                                                onClick={handleDownload} 
                                                className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors w-full sm:w-auto"
                                            >
                                                <DownloadIcon className="h-4 w-4 mr-2" />
                                                Unduh Laporan
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        {isLoading && (
                            <div className="w-full bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mb-4 border border-blue-100 dark:border-blue-800">
                                <div className="flex justify-between items-center mb-2 text-sm">
                                    <span className="text-blue-800 dark:text-blue-300 font-bold">{progress.message}</span>
                                    <div className="flex items-center gap-3">
                                         <span className="flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                            ⏱️ {elapsedTime}s
                                        </span>
                                        <span className="text-blue-600 dark:text-blue-400 font-mono text-xs">{progress.current}/{progress.total}</span>
                                    </div>
                                </div>
                                <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2.5 overflow-hidden mb-3">
                                    <div className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(37,99,235,0.5)]" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                                </div>
                                {/* Visualisasi File Aktif */}
                                {activeNames.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Sedang memproses (Klik X untuk lewati):</p>
                                        <div className="flex flex-wrap gap-2">
                                            {activeNames.map((name, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-white dark:bg-blue-900 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 truncate animate-pulse shadow-sm">
                                                    <span className="truncate max-w-[150px]">{name}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleManualSkip(name); }}
                                                        className="ml-1.5 text-blue-400 hover:text-red-500 font-bold focus:outline-none"
                                                        title="Lewati file ini (Manual Skip)"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isLoading && results.length > 0 && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800 text-center text-sm text-blue-900 dark:text-blue-200">
                                <p>
                                    ✅ Penilaian <strong>{results.length}</strong> mahasiswa selesai dalam <strong>{elapsedTime}</strong> detik.
                                    <br/>
                                    <span className="text-xs text-blue-600 dark:text-blue-400 opacity-80">(Rata-rata {(elapsedTime / results.length).toFixed(1)} detik/mhs)</span>
                                </p>
                            </div>
                        )}
                        
                         {/* Statistik & Grafik Distribusi */}
                         {stats.count > 0 && !isLoading && (
                            <div className="lg:flex lg:gap-4 lg:items-stretch mb-4">
                                {/* Statistik Kunci - Kompak */}
                                <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:w-40 mb-3 lg:mb-0">
                                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 flex flex-col justify-center text-center">
                                        <p className="text-[10px] font-bold text-green-800 dark:text-green-300 uppercase">Tertinggi</p>
                                        <p className="text-xl font-extrabold text-green-600 dark:text-green-400">{stats.highest}</p>
                                    </div>
                                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800 flex flex-col justify-center text-center">
                                        <p className="text-[10px] font-bold text-yellow-800 dark:text-yellow-300 uppercase">Rata-rata</p>
                                        <p className="text-xl font-extrabold text-yellow-600 dark:text-yellow-400">{stats.average.toFixed(1)}</p>
                                    </div>
                                    <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 flex flex-col justify-center text-center">
                                        <p className="text-[10px] font-bold text-red-800 dark:text-red-300 uppercase">Terendah</p>
                                        <p className="text-xl font-extrabold text-red-600 dark:text-red-400">{stats.lowest}</p>
                                    </div>
                                </div>

                                {/* Grafik Distribusi Normal */}
                                <div className="flex-1 bg-white dark:bg-gray-800 p-2 lg:p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-6 text-center uppercase tracking-wide">Distribusi Nilai (Histogram)</p>
                                    <div className="flex items-end justify-between h-24 lg:h-full gap-1 px-1">
                                        {stats.distribution.map((count, idx) => {
                                            const percentage = (count / maxDistribution) * 100;
                                            const rangeLabel = idx === 9 ? '90-100' : `${idx*10}-${(idx*10)+9}`;
                                            return (
                                                <div key={idx} className="flex-1 flex flex-col items-center group relative h-full">
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-[9px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20">
                                                        {rangeLabel}: {count} Mhs
                                                    </div>
                                                    {/* Pembungkus Bar - Butuh h-full agar tinggi persentase benar */}
                                                    <div className="h-full w-full flex items-end justify-center">
                                                        <div 
                                                            className={`w-full rounded-t-sm transition-all duration-500 relative ${getBarColor(idx)}`}
                                                            style={{ height: `${Math.max(percentage, 5)}%` }}
                                                        >
                                                            {count > 0 && (
                                                                <span className="absolute -top-3 w-full text-center text-[9px] font-bold text-gray-600 dark:text-gray-400">
                                                                    {count}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Label Sumbu X */}
                                                    <span className="text-[8px] text-gray-400 mt-0.5">{idx*10}</span>
                                                    <div className="w-full border-t border-gray-100 dark:border-gray-700 absolute bottom-3 left-0 -z-10"></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {error && <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-r-md">{error}</div>}
                        
                        {results.length > 0 ? (
                            <div className="flex-grow overflow-y-auto mt-2 custom-scrollbar rounded-lg border border-gray-200 dark:border-gray-700 lg:min-h-0 lg:flex-grow">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                                        <tr>
                                            <th 
                                                scope="col" 
                                                className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none group first:rounded-tl-lg"
                                                onClick={() => handleSort('fileName')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Nama Mahasiswa
                                                    <SortIcon active={sortConfig.key === 'fileName'} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            <th 
                                                scope="col" 
                                                className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none group"
                                                onClick={() => handleSort('grade')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Skor Akhir
                                                    <SortIcon active={sortConfig.key === 'grade'} direction={sortConfig.direction} />
                                                </div>
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider last:rounded-tr-lg">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {sortedResults.map((res, index) => (
                                            <tr 
                                                key={res.fileName || index} 
                                                onClick={() => { setSelectedResult(res); setShowOcr(false); }}
                                                className="hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs" title={res.fileName}>{res.fileName}</td>
                                                <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${getGradeColor(res.grade)}`}>
                                                    {res.grade === 0 && res.improvements.includes("GAGAL") ? (
                                                        <span className="text-red-600 text-xs">GAGAL/TIMEOUT</span>
                                                    ) : res.grade}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 font-medium">
                                                    Buka &rarr;
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : !isLoading && (
                            <div className="flex-grow flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 opacity-60">
                                <div className="text-6xl mb-4">📊</div>
                                <p className="text-lg font-medium">Belum ada data penilaian kelas.</p>
                                <p className="text-sm">Silakan unggah file dan klik Mulai Penilaian AI</p>
                            </div>
                        )}
                     </div>
                 </div>
            </div>

             {/* Modal Peringatan Duplikasi */}
             {showDuplicateWarning && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-yellow-300 dark:border-yellow-700 transform transition-all scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Duplikasi Mahasiswa Terdeteksi</h3>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                Sistem menemukan nama mahasiswa yang sama dalam unggahan Anda. Jika dilanjutkan, hasil penilaian mungkin akan memiliki nama yang sama dan membingungkan.
                            </p>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                                <p className="text-xs font-bold text-yellow-800 dark:text-yellow-400 mb-1">Nama Duplikat:</p>
                                <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                    {duplicateNames.map((name, i) => (
                                        <li key={i} className="truncate">{name}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDuplicateWarning(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Batalkan
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600 rounded-lg transition-colors shadow-sm"
                            >
                                Tetap Lanjutkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detail */}
            {selectedResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 shadow-2xl w-full h-full sm:h-[90vh] sm:rounded-xl sm:max-w-[95vw] xl:max-w-[90vw] flex flex-col overflow-hidden animate-scale-in transition-colors duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate pr-4">
                                    Hasil Analisis: {selectedResult.fileName}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Mode Detail & Verifikasi</p>
                            </div>
                            <button 
                                onClick={() => setSelectedResult(null)}
                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Konten Scrollable */}
                        <div className="p-6 overflow-y-auto space-y-6 bg-white dark:bg-gray-800 flex-grow">
                             {/* Header Skor */}
                            <div className="text-center p-4 bg-gradient-to-b from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600">
                                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nilai Akhir</span>
                                <div className={`text-6xl font-extrabold ${getGradeColor(selectedResult.grade)} mt-1`}>
                                    {selectedResult.grade}<span className="text-2xl text-gray-400 dark:text-gray-500 font-normal">/100</span>
                                </div>
                            </div>

                            {/* Bagian Verifikasi OCR */}
                            {selectedResult.studentText && (
                                <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-600 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <button 
                                        onClick={() => setShowOcr(!showOcr)}
                                        className="w-full flex justify-between items-center p-4 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className="text-xl bg-white dark:bg-gray-700 p-1 rounded-full shadow-sm">🔍</span>
                                            <div>
                                                <span className="font-bold text-blue-900 dark:text-blue-200 block">Cek Bacaan AI (OCR)</span>
                                                <span className="text-xs text-blue-600 dark:text-blue-400">Klik untuk melihat apa yang dibaca AI dari file asli</span>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-center min-w-[120px] inline-block ${showOcr ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-gray-600'}`}>
                                            {showOcr ? 'Sembunyikan Teks' : 'Tampilkan Teks'}
                                        </span>
                                    </button>
                                    {showOcr && (
                                        <div className="p-5 bg-white dark:bg-gray-800 border-t border-blue-100 dark:border-gray-600">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-100 dark:border-yellow-900/30">
                                                <strong>Info:</strong> Ini adalah teks mentah yang diekstrak AI. Jika ada kesalahan penilaian, cek apakah tulisan di sini sesuai dengan dokumen asli.
                                            </p>
                                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-inner">
                                                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono max-h-80 overflow-y-auto custom-scrollbar leading-relaxed">
                                                    {selectedResult.studentText}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                             {/* Feedback Detail */}
                             <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg border-b dark:border-gray-700 pb-2">
                                    <CheckIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                                    Rincian Analisis Per Soal
                                </h4>
                                <div className="space-y-6">
                                    {selectedResult.detailedFeedback.map((item, idx) => {
                                        const isEmptyAnswer = item.studentAnswer?.includes('[TIDAK DIKERJAKAN]');

                                        return (
                                            <div key={idx} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200 hover:border-blue-300 dark:hover:border-blue-500">
                                                <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                                    <span className="font-black text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">Soal #{item.questionNumber}</span>
                                                    <div className="text-right">
                                                        {isEmptyAnswer ? (
                                                            <span className="text-xs font-bold px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded uppercase tracking-wide">KOSONG</span>
                                                        ) : (
                                                            <span className={`text-xl font-bold ${getGradeColor(item.score)}`}>
                                                                {item.score}/100
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {item.questionText && (
                                                    <div className="mb-4">
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 block">Pertanyaan</span>
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-400 dark:border-blue-600 text-sm text-blue-900 dark:text-blue-200 font-medium">
                                                            {item.questionText}
                                                        </div>
                                                    </div>
                                                )}

                                                {item.lecturerAnswer && (
                                                    <div className="mb-4">
                                                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1 block">Standar Jawaban Dosen</span>
                                                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400 dark:border-green-600 text-sm text-green-900 dark:text-green-200 italic">
                                                            {item.lecturerAnswer}
                                                        </div>
                                                    </div>
                                                )}

                                                {item.studentAnswer && (
                                                    <div className="mb-4">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Jawaban Mahasiswa (Terbaca)</span>
                                                            {!isEmptyAnswer && <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Salinan Lengkap</span>}
                                                        </div>
                                                        {isEmptyAnswer ? (
                                                            <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 italic text-sm">
                                                                <span>🚫</span>
                                                                <span>Tidak ada jawaban terdeteksi untuk soal ini.</span>
                                                            </div>
                                                        ) : (
                                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 rounded-lg shadow-inner">
                                                                <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">{item.studentAnswer}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 block">Analisis & Umpan Balik AI</span>
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.feedback}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Saran Pengembangan */}
                            <div className="p-5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50">
                                <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                                    <span className="text-xl">💡</span> Saran Pengembangan Diri
                                </h4>
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap pl-8">
                                    {selectedResult.improvements}
                                </p>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                            <button 
                                onClick={() => setSelectedResult(null)}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassMode;
