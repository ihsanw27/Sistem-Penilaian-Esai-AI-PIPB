import React, { useState, useCallback, useEffect, useRef } from 'react';
import { fileToBase64, processUploadedFiles } from '../utils/fileUtils';
import { gradeAnswer } from '../services/geminiService';
import { GradeResult } from '../types';
import { UploadIcon, CheckIcon, XIcon, PaperclipIcon, StopIcon } from './icons';
import { extractTextFromOfficeFile } from '../utils/officeFileUtils';

/**
 * SingleStudentGrader component for grading a single student's submission.
 * It allows uploading student answer files and a lecturer's answer key (either as files or text).
 * It then calls the Gemini API to get a grade and detailed feedback.
 * @returns {React.ReactElement} The rendered SingleStudentGrader component.
 */
const SingleStudentGrader: React.FC = () => {
    // State for student's uploaded answer files.
    const [studentFiles, setStudentFiles] = useState<File[]>([]);
    // State for lecturer's uploaded answer key files.
    const [lecturerFiles, setLecturerFiles] = useState<File[]>([]);
    // State for lecturer's answer key provided as text.
    const [lecturerAnswerText, setLecturerAnswerText] = useState<string>('');
    // State to toggle the input method for the answer key ('file' or 'text').
    const [answerKeyInputMethod, setAnswerKeyInputMethod] = useState<'file' | 'text'>('file');
    // State to control if the lecturer's answer key is kept for subsequent gradings.
    const [keepLecturerAnswer, setKeepLecturerAnswer] = useState<boolean>(true);
    // State to store the result from the grading API.
    const [result, setResult] = useState<GradeResult | null>(null);
    // State to manage the loading status during API calls.
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // State for storing and displaying error messages.
    const [error, setError] = useState<string | null>(null);
    // State to track elapsed time during processing.
    const [elapsedTime, setElapsedTime] = useState(0);
    // State to toggle the visibility of the OCR'd text.
    const [showOcr, setShowOcr] = useState(false);
    
    // Ref to track cancellation status
    const abortRef = useRef<boolean>(false);
    
    // Constant defining the accepted file types for uploads.
    const acceptedFileTypes = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed";

    // Effect to handle the elapsed time counter.
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isLoading) {
            setElapsedTime(0); // Reset timer on start
            timer = setInterval(() => {
                setElapsedTime(prevTime => prevTime + 1);
            }, 1000);
        }
        return () => {
            clearInterval(timer);
        };
    }, [isLoading]);

    /**
     * Handles changes to the student file input element.
     * Use processUploadedFiles to handle ZIP expansion.
     * @param e - The React change event from the file input.
     */
    const handleStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            // Explicitly cast to File[] to avoid 'unknown[]' type error
            const rawFiles = Array.from(files) as File[];
            // Process (unzip if necessary)
            const processed = await processUploadedFiles(rawFiles);
            setStudentFiles(processed);
        }
    };
    
    /**
     * Handles changes to the lecturer file input element.
     * Now supports ZIP processing similar to student input.
     * @param e - The React change event from the file input.
     */
    const handleLecturerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const rawFiles = Array.from(files) as File[];
            // Process (unzip if necessary) - Extracts contents to be used as reference
            const processed = await processUploadedFiles(rawFiles);
            setLecturerFiles(processed);
        }
    };
    
    /**
     * Switches the input method for the lecturer's answer key and resets the other method's state.
     * @param method - The selected input method: 'file' or 'text'.
     */
    const handleAnswerKeyMethodChange = (method: 'file' | 'text') => {
        setAnswerKeyInputMethod(method);
        if (method === 'file') {
            setLecturerAnswerText('');
        } else {
            setLecturerFiles([]);
        }
    };

    /**
     * Pastes text from the user's clipboard into the lecturer answer text area.
     */
    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setLecturerAnswerText(prev => prev + text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            setError('Gagal membaca dari clipboard. Pastikan Anda telah memberikan izin.');
        }
    };

    /**
     * Processes an array of files into a format suitable for the Gemini API.
     * Extracts text from Office documents or converts other files to base64.
     * @param files - An array of File objects to process.
     * @returns A promise that resolves to an array of content parts for the API.
     */
    const processFilesToParts = async (files: File[]) => {
        const parts = await Promise.all(
            files.map(async (file) => {
                const officeMimeTypes = [
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ];
                
                if (officeMimeTypes.includes(file.type)) {
                    try {
                        const text = await extractTextFromOfficeFile(file);
                        return { text: `--- Start of file: ${file.name} ---\n${text}\n--- End of file: ${file.name} ---` };
                    } catch (e) {
                        console.error(`Error processing office file ${file.name}:`, e);
                        return { text: `--- Error processing file: ${file.name} ---`};
                    }
                } else {
                    const base64 = await fileToBase64(file);
                    return {
                        inlineData: {
                            data: base64,
                            mimeType: file.type,
                        }
                    };
                }
            })
        );
        return parts;
    };

    /**
     * Handles the form submission to start the grading process.
     * It prepares the data and calls the `gradeAnswer` service.
     */
    const handleSubmit = useCallback(async () => {
        const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());
        if (studentFiles.length === 0 || isLecturerInputMissing) {
            setError("Harap unggah file jawaban mahasiswa dan berikan kunci jawaban dosen.");
            return;
        }
        
        // Initialize state
        setIsLoading(true);
        setError(null);
        setResult(null);
        setShowOcr(false);
        abortRef.current = false; // Reset cancellation flag

        try {
            // Process student and lecturer files into parts for the API.
            const studentFileParts = await processFilesToParts(studentFiles);
            const lecturerAnswerPayload: { parts?: any[], text?: string } = {};

            if (answerKeyInputMethod === 'file' && lecturerFiles.length > 0) {
                 lecturerAnswerPayload.parts = await processFilesToParts(lecturerFiles);
            } else if (answerKeyInputMethod === 'text' && lecturerAnswerText) {
                lecturerAnswerPayload.text = lecturerAnswerText;
            }
            
            // Check cancellation before calling API (in case file processing took long)
            if (abortRef.current) {
                throw new Error("Proses dibatalkan oleh pengguna.");
            }

            // Call the grading service.
            const gradingResult = await gradeAnswer(studentFileParts, lecturerAnswerPayload);
            
            // Check cancellation after API return
            if (abortRef.current) {
                throw new Error("Proses dibatalkan oleh pengguna.");
            }

            if (gradingResult) {
                setResult(gradingResult);
                setStudentFiles([]); // Always clear student files after grading.
                if (!keepLecturerAnswer) {
                    // Clear lecturer's answer if the option is unchecked.
                    setLecturerFiles([]);
                    setLecturerAnswerText('');
                }
            } else {
                setError("Gagal mendapatkan hasil penilaian yang valid dari API.");
            }
        } catch (err: any) {
            if (abortRef.current || err.message === "Proses dibatalkan oleh pengguna.") {
                setError("Penilaian dibatalkan.");
            } else {
                setError("Terjadi kesalahan tak terduga selama proses penilaian.");
                console.error(err);
            }
        } finally {
            setIsLoading(false);
        }
    }, [studentFiles, lecturerFiles, answerKeyInputMethod, lecturerAnswerText, keepLecturerAnswer]);

    /**
     * Cancels the ongoing grading process.
     */
    const handleCancel = () => {
        abortRef.current = true;
        setIsLoading(false);
        setError("Proses dibatalkan oleh pengguna.");
    };

    /**
     * Determines the CSS color class for the grade based on its value.
     * @param grade - The numerical grade (0-100).
     * @returns A string containing Tailwind CSS color classes.
     */
    const getGradeColor = (grade: number) => {
        if (grade >= 90) return 'text-green-600 dark:text-green-400';
        if (grade >= 70) return 'text-yellow-600 dark:text-yellow-400';
        if (grade >= 50) return 'text-orange-500 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
    };

    // Derived state to disable the submit button if inputs are missing.
    const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());

    // Determine container classes for the results panel
    const resultsContainerClass = (!result && !isLoading) 
        ? "h-full flex flex-col justify-center items-center" 
        : "h-[80vh] lg:h-[85vh] flex flex-col";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Inputs */}
                <div className="space-y-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm transition-colors duration-200">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4">Langkah 1: Unggah Jawaban Mahasiswa</h2>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah File Jawaban</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-blue-200 dark:border-blue-800 border-dashed rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="space-y-1 text-center">
                                {studentFiles.length === 0 ? (
                                    <>
                                        <UploadIcon className="mx-auto h-12 w-12 text-blue-400 dark:text-blue-500" />
                                        <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center mt-2">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-sky-50 dark:focus-within:ring-offset-gray-900 focus-within:ring-blue-500 px-2 pb-1">
                                                <span>Pilih File</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                            </label>
                                            <p className="pl-1">atau seret ke sini</p>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400 font-medium">Mode Individu: Gabungkan File (Merge).</p>
                                            <p>Semua file (termasuk isi ZIP) akan digabung jadi 1 jawaban mahasiswa.</p>
                                            <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <PaperclipIcon className="mx-auto h-12 w-12 text-blue-500" />
                                        <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">{studentFiles.length} berkas siap dinilai</p>
                                        <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside text-left max-h-24 overflow-y-auto mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                            {studentFiles.map((file, i) => <li key={i} className="truncate">{file.name}</li>)}
                                        </ul>
                                        <div className="flex justify-center items-center gap-3 mt-3">
                                            <label htmlFor="file-upload" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                Ganti
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
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
                    
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4 mt-8">Langkah 2: Unggah Soal & Kunci Jawaban</h2>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah Kunci Jawaban Dosen</label>
                         <div className="rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                             <div className="flex border-b border-gray-300 dark:border-gray-600">
                                <button
                                    onClick={() => handleAnswerKeyMethodChange('file')}
                                    className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${answerKeyInputMethod === 'file' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 dark:border-blue-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    Unggah File
                                </button>
                                <button
                                    onClick={() => handleAnswerKeyMethodChange('text')}
                                    className={`flex-1 px-4 py-2 font-medium text-sm transition-colors ${answerKeyInputMethod === 'text' ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 dark:border-blue-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                                >
                                    Ketik Manual
                                </button>
                            </div>
                             <div className="p-4 bg-white dark:bg-gray-800">
                                {answerKeyInputMethod === 'file' ? (
                                     <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-200 dark:border-gray-600 border-dashed rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <div className="space-y-1 text-center">
                                            {lecturerFiles.length === 0 ? (
                                                <>
                                                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                    <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center mt-2">
                                                        <label htmlFor="lecturer-file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-sky-50 dark:focus-within:ring-offset-gray-900 focus-within:ring-blue-500 px-2 pb-1">
                                                            <span>Pilih File Kunci</span>
                                                            <input id="lecturer-file-upload" name="lecturer-file-upload" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple/>
                                                        </label>
                                                    </div>
                                                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 space-y-1">
                                                        <p>Semua file (termasuk ZIP) akan digabung jadi satu referensi kunci.</p>
                                                        <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP.</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div>
                                                    <PaperclipIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                                                     <p className="mt-2 text-sm text-green-600 dark:text-green-400">{lecturerFiles.length} file referensi dipilih</p>
                                                     <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside text-left max-h-24 overflow-y-auto mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                                        {lecturerFiles.map((file, i) => <li key={i} className="truncate">{file.name}</li>)}
                                                    </ul>
                                                    <div className="flex justify-center items-center gap-3 mt-3">
                                                        <label htmlFor="lecturer-file-upload" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                            Ganti
                                                            <input id="lecturer-file-upload" name="lecturer-file-upload" type="file" className="sr-only" onChange={handleLecturerFileChange} accept={acceptedFileTypes} multiple />
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
                                                className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                                            >
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
                        <div className="flex items-center pt-3">
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
                    
                    {isLoading ? (
                        <button
                            onClick={handleCancel}
                            className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform active:scale-[0.98]"
                        >
                            Batalkan Proses
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={studentFiles.length === 0 || isLecturerInputMissing}
                            className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] dark:disabled:from-gray-600 dark:disabled:to-gray-600"
                        >
                            Mulai Penilaian AI
                        </button>
                    )}
                </div>

                {/* Results */}
                <div className={`p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-gray-700 shadow-md overflow-hidden relative transition-all duration-500 ease-in-out ${resultsContainerClass}`}>
                     {/* Sticky Header if results or loading */}
                     {(result || isLoading) && (
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 sticky top-0 bg-white/95 dark:bg-gray-800/95 py-3 -mx-4 px-4 border-b border-gray-100 dark:border-gray-700 z-10 flex items-center gap-2">
                            <span className="text-2xl">📝</span> Hasil Analisis AI
                        </h3>
                     )}
                    
                    {error && <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-r-md">{error}</div>}
                    
                    {isLoading && (
                         <div className="flex-grow flex flex-col items-center justify-center space-y-4">
                            <div className="relative">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 dark:border-blue-400"></div>
                                <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-t-4 border-b-4 border-blue-500 dark:border-blue-400 animate-ping opacity-20"></div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">AI sedang membaca tulisan mahasiswa...</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Mencocokkan dengan kunci jawaban Dosen secara verbatim.</p>
                                <div className="mt-3 inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                    ⏱️ Waktu berjalan: {elapsedTime} detik
                                </div>
                            </div>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6 animate-fade-in pb-8 overflow-y-auto custom-scrollbar flex-grow">
                            <div className="text-center p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600">
                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Skor Total</p>
                                <p className={`text-7xl font-extrabold ${getGradeColor(result.grade)} drop-shadow-sm`}>{result.grade}<span className="text-2xl text-gray-400 dark:text-gray-500 font-normal">/100</span></p>
                            </div>

                             {/* Student OCR Text Display */}
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

                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 flex items-center mb-4 text-lg border-b dark:border-gray-700 pb-2">
                                    <CheckIcon className="h-6 w-6 mr-2 text-green-500 dark:text-green-400" />
                                    Analisis Per Soal
                                </h4>
                                 <div className="space-y-6">
                                    {result.detailedFeedback.map((fb, index) => (
                                        <div key={index} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 transition-all">
                                            <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                                <span className="font-black text-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">Soal #{fb.questionNumber}</span>
                                                <div className="text-right">
                                                    <span className={`text-2xl font-bold ${getGradeColor(fb.score)}`}>{fb.score}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium block">Poin</span>
                                                </div>
                                            </div>
                                            
                                            {/* Display Question Text */}
                                            {fb.questionText && (
                                                <div className="mb-4">
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 block">Pertanyaan</span>
                                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-400 dark:border-blue-600 text-sm text-blue-900 dark:text-blue-200 font-medium">
                                                        {fb.questionText}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Display Lecturer Answer Key */}
                                            {fb.lecturerAnswer && (
                                                <div className="mb-4">
                                                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1 block">Standar Jawaban Dosen</span>
                                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400 dark:border-green-600 text-sm text-green-900 dark:text-green-200 italic">
                                                        {fb.lecturerAnswer}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Display Student Answer Text (OCR per Question) */}
                                            {fb.studentAnswer && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Jawaban Mahasiswa (Terbaca)</span>
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Salinan Lengkap</span>
                                                    </div>
                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 rounded-lg shadow-inner">
                                                        <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">{fb.studentAnswer}</p>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                 <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 block">Analisis & Umpan Balik AI</span>
                                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{fb.feedback}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-xl border border-yellow-200 dark:border-yellow-900/50">
                                <h4 className="font-bold text-yellow-800 dark:text-yellow-300 flex items-center mb-2">
                                    <span className="text-xl mr-2">💡</span> Saran Pengembangan Diri
                                </h4>
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed pl-7">{result.improvements}</p>
                            </div>

                            <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 pt-4">
                                <p>Analisis selesai dalam <strong>{elapsedTime}</strong> detik.</p>
                            </div>
                        </div>
                    )}
                    

                    {!isLoading && !result && !error && (
                         <div className="flex-grow flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 opacity-60">
                            <div className="text-6xl mb-4">📑</div>
                            <p className="text-lg font-medium">Hasil penilaian akan muncul di sini</p>
                            <p className="text-sm">Silakan unggah file dan klik Mulai Penilaian AI</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SingleStudentGrader;