
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fileToBase64, processUploadedFiles } from '../utils/fileUtils';
import { gradeAnswer } from '../services/geminiService';
import { GradeResult } from '../types';
import { UploadIcon, CheckIcon, XIcon, PaperclipIcon, ClipboardIcon } from './icons';
import { extractTextFromOfficeFile } from '../utils/officeFileUtils';
import AILoader from './AILoader';

interface SingleStudentGraderProps {
    /** Callback untuk memberi tahu parent (Dashboard) jika ada data aktif (file/hasil) */
    onDataDirty?: (isDirty: boolean) => void;
}

// MAX FILE SIZE: 10MB
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * @component SingleStudentGrader
 * @description Komponen untuk menilai kiriman satu siswa.
 * Memungkinkan unggahan file jawaban siswa dan kunci jawaban dosen.
 * Menggunakan Gemini API untuk mendapatkan nilai dan umpan balik terperinci.
 * 
 * @param {SingleStudentGraderProps} props - Props komponen.
 */
const SingleStudentGrader: React.FC<SingleStudentGraderProps> = ({ onDataDirty }) => {
    // --- STATE MANAGEMENT ---
    
    // State file jawaban siswa
    const [studentFiles, setStudentFiles] = useState<File[]>([]);
    // State file kunci jawaban dosen
    const [lecturerFiles, setLecturerFiles] = useState<File[]>([]);
    // State teks kunci jawaban dosen (opsi manual)
    const [lecturerAnswerText, setLecturerAnswerText] = useState<string>('');
    // Metode input kunci jawaban yang dipilih ('file' atau 'text')
    const [answerKeyInputMethod, setAnswerKeyInputMethod] = useState<'file' | 'text'>('file');
    // Opsi untuk menyimpan kunci jawaban setelah penilaian selesai
    const [keepLecturerAnswer, setKeepLecturerAnswer] = useState<boolean>(true);
    
    // Hasil penilaian dari API
    const [result, setResult] = useState<GradeResult | null>(null);
    // Status loading selama panggilan API
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // Pesan error
    const [error, setError] = useState<string | null>(null);
    // Waktu proses berjalan
    const [elapsedTime, setElapsedTime] = useState(0);
    // Toggle visibilitas teks OCR
    const [showOcr, setShowOcr] = useState(false);
    
    // Manajemen Pembatalan
    const abortRef = useRef<boolean>(false);

    const acceptedFileTypes = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed";

    // Effect: Melaporkan "Dirty State" ke parent dashboard
    useEffect(() => {
        if (onDataDirty) {
            const isDirty = studentFiles.length > 0 || result !== null;
            onDataDirty(isDirty);
        }
    }, [studentFiles, result, onDataDirty]);

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

    const handleStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (e.target.files) {
            const files = Array.from(e.target.files);
            
            // SECURITY CHECK: File Size
            const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE_BYTES);
            if (oversizedFiles.length > 0) {
                setError(`File terlalu besar: ${oversizedFiles.map(f => f.name).join(', ')}. Maksimal ${MAX_FILE_SIZE_MB}MB per file.`);
                e.target.value = ''; // Reset input
                return;
            }

            const processed = await processUploadedFiles(files);
            setStudentFiles(processed);
            setResult(null); // Reset hasil jika file berubah
        }
    };

    const handleLecturerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        if (e.target.files) {
            const files = Array.from(e.target.files);

             // SECURITY CHECK: File Size
             const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE_BYTES);
             if (oversizedFiles.length > 0) {
                 setError(`File kunci terlalu besar: ${oversizedFiles.map(f => f.name).join(', ')}. Maksimal ${MAX_FILE_SIZE_MB}MB per file.`);
                 e.target.value = '';
                 return;
             }

            const processed = await processUploadedFiles(files);
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

    const handleCancel = () => {
        abortRef.current = true;
        setIsLoading(false);
        setError('Proses dibatalkan oleh pengguna.');
    };

    const handleGrade = async () => {
        const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());
        
        if (studentFiles.length === 0 || isLecturerInputMissing) {
            setError("Harap unggah jawaban mahasiswa dan kunci jawaban dosen.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);
        setShowOcr(false);
        abortRef.current = false;

        try {
            // 1. Siapkan Kunci Jawaban (Konteks)
            const lecturerAnswerPayload: { parts?: any[], text?: string } = {};
            if (answerKeyInputMethod === 'file') {
                const lecturerParts = await Promise.all(
                    lecturerFiles.map(async (file) => {
                         // Coba ekstrak teks jika file Office
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
                lecturerAnswerPayload.parts = lecturerParts;
            } else {
                lecturerAnswerPayload.text = lecturerAnswerText;
            }

            // 2. Siapkan Jawaban Siswa
            const studentParts = await Promise.all(
                studentFiles.map(async (file) => {
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

            if (abortRef.current) return;

            // 3. Panggil Layanan AI
            const gradingResult = await gradeAnswer(studentParts, lecturerAnswerPayload);

            if (abortRef.current) return;

            if (gradingResult) {
                // Tambahkan nama file untuk referensi
                gradingResult.fileName = studentFiles.map(f => f.name).join(', ');
                setResult(gradingResult);
            } else {
                setError("Gagal mendapatkan penilaian dari AI. Silakan coba lagi.");
            }
        } catch (err: any) {
            console.error(err);
            setError(`Terjadi kesalahan: ${err.message || 'Unknown error'}`);
        } finally {
            if (!abortRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleResetAll = () => {
        setResult(null);
        setStudentFiles([]);
        if (!keepLecturerAnswer) {
            setLecturerFiles([]);
            setLecturerAnswerText('');
        }
        setError(null);
        setShowOcr(false);
    };

    const getGradeColor = (grade: number) => {
        if (grade >= 80) return 'text-green-600 dark:text-green-400';
        if (grade >= 60) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* --- PANEL INPUT (KIRI) --- */}
            <div className="space-y-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm transition-colors duration-200">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
                    <span className="text-xl">📤</span> Langkah 1: Unggah Jawaban Mahasiswa
                </h2>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah File Mahasiswa (Merge)</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-blue-200 dark:border-blue-800 border-dashed rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="space-y-1 text-center">
                            {studentFiles.length === 0 ? (
                                <>
                                    <UploadIcon className="mx-auto h-12 w-12 text-blue-400 dark:text-blue-500" />
                                    <label htmlFor="student-file-upload-single" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 pb-1">
                                        <span>Pilih File</span>
                                        <input id="student-file-upload-single" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                    </label>
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                        <p className="text-blue-600 dark:text-blue-400 font-medium">Mode Individu: Semua file digabung jadi 1 jawaban.</p>
                                        <p>ZIP akan diekstrak dan isinya digabung (Flatten).</p>
                                        <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP. Maks 10MB/file.</p>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <PaperclipIcon className="mx-auto h-12 w-12 text-blue-500" />
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{studentFiles.length} file dipilih</p>
                                    <div className="flex justify-center items-center gap-3 mt-3">
                                        <label htmlFor="student-file-upload-single" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                            Ganti
                                            <input id="student-file-upload-single" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                        </label>
                                        <button
                                            onClick={() => setStudentFiles([])}
                                            className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4 mt-8 flex items-center gap-2">
                    <span className="text-xl">🔑</span> Langkah 2: Unggah Soal & Kunci Jawaban
                </h2>
                <div>
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
                                                <label htmlFor="lecturer-file-upload-single" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 pb-1">
                                                    <span>Pilih File Kunci</span>
                                                    <input id="lecturer-file-upload-single" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple/>
                                                </label>
                                                <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 space-y-1">
                                                    <p>Semua file (termasuk ZIP) akan digabung jadi satu referensi kunci.</p>
                                                    <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP. Maks 10MB/file.</p>
                                                </div>
                                            </>
                                        ) : (
                                            <div>
                                                <PaperclipIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                <p className="mt-2 text-sm text-green-600 dark:text-green-400">{lecturerFiles.length} file referensi dipilih</p>
                                                <div className="flex justify-center items-center gap-3 mt-3">
                                                    <label htmlFor="lecturer-file-upload-single" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                        Ganti
                                                        <input id="lecturer-file-upload-single" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple />
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
                                id="keep-lecturer-answer-single"
                                name="keep-lecturer-answer-single"
                                type="checkbox"
                                checked={keepLecturerAnswer}
                                onChange={(e) => setKeepLecturerAnswer(e.target.checked)}
                                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            />
                            <label htmlFor="keep-lecturer-answer-single" className="ml-2 block text-sm text-gray-600 dark:text-gray-400">
                                Ingat kunci jawaban untuk penilaian berikutnya
                            </label>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <>
                        <div className="w-full text-center mb-2">
                             <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-mono border border-blue-200 dark:border-blue-700">
                                ⏱️ Waktu berjalan: {elapsedTime} detik
                            </div>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform active:scale-[0.98]"
                        >
                            Batalkan Proses
                        </button>
                    </>
                ) : (
                    <>
                         <div className="mt-4 flex flex-col items-center">
                            <button 
                                onClick={handleGrade} 
                                disabled={studentFiles.length === 0 || isLecturerInputMissing} 
                                className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] dark:disabled:from-gray-600 dark:disabled:to-gray-600"
                            >
                                Mulai Penilaian AI
                            </button>
                        </div>
                    </>
                )}
                
                {error && <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-r-md">{error}</div>}
            </div>

            {/* --- PANEL HASIL (KANAN) --- */}
            {/* Absolute Fill Strategy: Di desktop, panel ini 'absolute' mengisi tinggi parent (Left Input Panel). 
                Di mobile, 'relative' agar memanjang ke bawah. */}
            <div className="relative flex flex-col min-h-[500px] lg:min-h-0">
                <div className={`p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-gray-700 shadow-md flex flex-col transition-all duration-500 ease-in-out w-full relative h-auto lg:absolute lg:inset-0 lg:overflow-y-auto custom-scrollbar`}>
                    
                    {/* Sticky Header */}
                    {result && (
                         <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 py-3 pt-5 pb-3 -mx-4 px-4 -mt-4 border-b border-gray-100 dark:border-gray-700 z-10 flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`text-5xl font-extrabold ${getGradeColor(result.grade)}`}>
                                    {result.grade}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 leading-tight">Hasil Analisis AI</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Skor / 100</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleResetAll}
                                className="inline-flex justify-center items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                <UploadIcon className="h-4 w-4 mr-2" />
                                Mulai Penilaian Baru
                            </button>
                        </div>
                    )}

                    {!result && !isLoading && (
                         <div className="flex-grow flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 opacity-60">
                            <div className="text-6xl mb-4">📝</div>
                            <p className="text-lg font-medium">Belum ada hasil penilaian.</p>
                            <p className="text-sm">Silakan unggah file dan klik Mulai Penilaian AI</p>
                        </div>
                    )}
                    
                    {isLoading && (
                         <div className="flex-grow flex flex-col items-center justify-center">
                            <AILoader 
                                status="AI Sedang Berpikir..." 
                                subStatus="Membaca dokumen, menganalisis jawaban, dan mencocokkan dengan kunci..." 
                            />
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6">
                            {/* Transkripsi OCR Global */}
                            {result.studentText && (
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
                                        {/* Updated Button Style: Centered Text & Min-Width */}
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
                                                    {result.studentText}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Detail Feedback Cards */}
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg border-b dark:border-gray-700 pb-2">
                                    <CheckIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                                    Rincian Analisis Per Soal
                                </h4>
                                <div className="space-y-6">
                                    {result.detailedFeedback.map((item, idx) => {
                                        const isEmptyAnswer = item.studentAnswer?.includes('[TIDAK DIKERJAKAN]');

                                        return (
                                            <div 
                                                key={idx} 
                                                className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200 hover:border-blue-300 dark:hover:border-blue-500"
                                            >
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

                                                {/* Kolom Soal Asli */}
                                                {item.questionText && (
                                                    <div className="mb-4">
                                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 block">Pertanyaan</span>
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-400 dark:border-blue-600 text-sm text-blue-900 dark:text-blue-200 font-medium">
                                                            {item.questionText}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Kolom Kunci Jawaban Dosen */}
                                                {item.lecturerAnswer && (
                                                    <div className="mb-4">
                                                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1 block">Standar Jawaban Dosen</span>
                                                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400 dark:border-green-600 text-sm text-green-900 dark:text-green-200 italic">
                                                            {item.lecturerAnswer}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Kolom Jawaban Mahasiswa (Verbatim) */}
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
                                                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 rounded-lg shadow-inner border-l-4 border-l-gray-400 dark:border-l-gray-500">
                                                                <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap break-words leading-relaxed">{item.studentAnswer}</p>
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
                            
                            <div className="p-5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50">
                                <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                                    <span className="text-xl">💡</span> Saran Pengembangan Diri
                                </h4>
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap pl-8">
                                    {result.improvements}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SingleStudentGrader;
