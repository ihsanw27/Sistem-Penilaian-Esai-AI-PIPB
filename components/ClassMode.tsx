import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { fileToBase64, processUploadedFiles } from '../utils/fileUtils';
import { gradeAnswer } from '../services/geminiService';
import { GradeResult } from '../types';
import { UploadIcon, PaperclipIcon, DownloadIcon, XIcon, CheckIcon, StopIcon } from './icons';
import { extractTextFromOfficeFile } from '../utils/officeFileUtils';
import { generateCsv, downloadCsv } from '../utils/csvUtils';

// SAFETY TIMEOUT: 15 Minutes. 
// This is effectively "no timeout" for normal use cases, but acts as a safety net
// to prevent the queue from hanging forever if a network request completely dies.
const SAFETY_TIMEOUT_MS = 15 * 60 * 1000; 

/**
 * ClassMode component for grading multiple student submissions in a batch.
 * It allows uploading a set of student files and a single lecturer's answer key.
 * It processes the files concurrently and displays the results in a table.
 * Users can also download the aggregated results as a CSV file.
 * @returns {React.ReactElement} The rendered ClassMode component.
 */
const ClassMode: React.FC = () => {
    // State for student answer files.
    const [studentFiles, setStudentFiles] = useState<File[]>([]);
    // State for lecturer's answer key files.
    const [lecturerFiles, setLecturerFiles] = useState<File[]>([]);
    // State for lecturer's answer key provided as text.
    const [lecturerAnswerText, setLecturerAnswerText] = useState<string>('');
    // State to toggle between file upload or text input for the answer key.
    const [answerKeyInputMethod, setAnswerKeyInputMethod] = useState<'file' | 'text'>('file');
    // State to control whether the lecturer's answer key is preserved after grading.
    const [keepLecturerAnswer, setKeepLecturerAnswer] = useState<boolean>(true);
    // State to store the grading results for all students.
    const [results, setResults] = useState<GradeResult[]>([]);
    // State to indicate if the grading process is in progress.
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // State for storing and displaying error messages.
    const [error, setError] = useState<string | null>(null);
    // State to track the progress of the batch grading process.
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    // State to track elapsed time during processing.
    const [elapsedTime, setElapsedTime] = useState(0);
    // State for the currently selected result to show in modal
    const [selectedResult, setSelectedResult] = useState<GradeResult | null>(null);
    // State to toggle the visibility of the OCR'd text in the modal.
    const [showOcr, setShowOcr] = useState(false);
    
    // Duplicate detection states
    const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
    const [showDuplicateWarning, setShowDuplicateWarning] = useState<boolean>(false);

    // Performance Mode removed: We are using a fixed optimized strategy now.
    
    // Track active jobs to allow manual cancellation via UI
    // Map of fileName -> reject function
    const [activeJobCancellers, setActiveJobCancellers] = useState<Record<string, () => void>>({});
    
    // Ref to handle Batch Cancellation
    const abortBatchRef = useRef<boolean>(false);
    
    // Accepted file types for uploads.
    const acceptedFileTypes = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed";
    
    // Effect to handle the elapsed time counter.
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isLoading) {
            setElapsedTime(0); // Reset timer
            timer = setInterval(() => {
                setElapsedTime(prevTime => prevTime + 1);
            }, 1000);
        }
        return () => {
            clearInterval(timer);
        };
    }, [isLoading]);


    // Memoized calculation for class statistics (highest, lowest, average grade).
    const stats = useMemo(() => {
        // Filter out results that are marked as failed/error
        // Check for specific error markers set in gradeSingleFile catch block
        const validResults = results.filter(r => 
            !r.improvements?.includes("GAGAL") && 
            !r.studentText?.includes("Proses dibatalkan")
        );

        if (validResults.length === 0) {
            return { highest: 0, lowest: 0, average: 0 };
        }
        
        const grades = validResults.map(r => r.grade);
        const highest = Math.max(...grades);
        const lowest = Math.min(...grades);
        const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
        
        return { highest, lowest, average };
    }, [results]);

    // Memoized hook to sort results by filename for consistent display.
    const sortedResults = useMemo(() => {
        return [...results].sort((a, b) => {
            // Ensure fileName exists before comparing
            if (!a.fileName || !b.fileName) return 0;
            return a.fileName.localeCompare(b.fileName);
        });
    }, [results]);

    /**
     * Determines the CSS color class for the grade based on its value.
     */
    const getGradeColor = (grade: number) => {
        if (grade >= 90) return 'text-green-600 dark:text-green-400';
        if (grade >= 70) return 'text-yellow-600 dark:text-yellow-400';
        if (grade >= 50) return 'text-orange-500 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
    };

    /**
     * Handles changes to the student file input.
     * Uses processUploadedFiles to handle zip extraction.
     * @param e - The React change event from the file input element.
     */
    const handleStudentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            // Explicitly cast to File[] to avoid 'unknown[]' type error
            const rawFiles = Array.from(files) as File[];
            const processed = await processUploadedFiles(rawFiles);
            setStudentFiles(processed);
            // Reset duplicate warning state on new upload
            setDuplicateFiles([]);
            setShowDuplicateWarning(false);
        }
    };
    
    /**
     * Handles changes to the lecturer file input.
     * Now supports ZIP processing (extract and merge).
     * @param e - The React change event from the file input element.
     */
    const handleLecturerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const rawFiles = Array.from(files) as File[];
            // Process (unzip if necessary)
            const processed = await processUploadedFiles(rawFiles);
            setLecturerFiles(processed);
        }
    };
    
    /**
     * Switches the input method for the lecturer's answer key.
     * @param method - The selected method, either 'file' or 'text'.
     */
    const handleAnswerKeyMethodChange = (method: 'file' | 'text') => {
        setAnswerKeyInputMethod(method);
        if (method === 'file') setLecturerAnswerText('');
        else setLecturerFiles([]);
    };

    /**
     * Pastes text from the clipboard into the lecturer's answer key textarea.
     */
    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setLecturerAnswerText(prev => prev + text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            setError('Gagal membaca dari clipboard. Pastikan izin browser diberikan.');
        }
    };

    /**
     * Processes an array of files into a format suitable for the Gemini API.
     * It handles text extraction for Office documents and base64 encoding for other file types.
     * @param files - An array of File objects.
     * @returns A promise that resolves to an array of content parts.
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

    /**
     * Manually skip/cancel a specific file job.
     * @param fileName - The name of the file to skip.
     */
    const handleManualSkip = (fileName: string) => {
        const cancel = activeJobCancellers[fileName];
        if (typeof cancel === 'function') {
            cancel(); // Trigger the reject
        }
    };
    
    /**
     * Cancels the entire batch grading process.
     */
    const handleCancelBatch = () => {
        // 1. Set global abort flag to stop new jobs from starting
        abortBatchRef.current = true;
        
        // 2. Reject all currently active jobs
        Object.values(activeJobCancellers).forEach((cancelFunc) => {
            if (typeof cancelFunc === 'function') {
                cancelFunc();
            }
        });
        
        // 3. Reset state
        setIsLoading(false);
        setProgress(prev => ({ ...prev, message: 'Proses dibatalkan oleh pengguna.' }));
    };

    /**
     * Grades a single student's file against the lecturer's answer key.
     * Includes a timeout mechanism to prevent stalling.
     * @param file - The student's answer file.
     * @param lecturerAnswerPayload - The processed lecturer's answer key.
     * @returns A promise resolving to the grade result.
     */
    const gradeSingleFile = useCallback(async (
        file: File,
        lecturerAnswerPayload: any
    ): Promise<GradeResult | null> => {
        const gradingPromise = async () => {
            try {
                const studentFileParts = await processFilesToParts([file]);
                const gradingResult = await gradeAnswer(studentFileParts, lecturerAnswerPayload);
                
                if (gradingResult) {
                    return { ...gradingResult, fileName: file.name };
                }
                return null;
            } catch (e) {
                console.error(`Failed to grade ${file.name}:`, e);
                throw e;
            }
        };

        // Create a cancellable promise for timeout or manual skip
        // Initialize with no-op to satisfy potential strict usage checks, 
        // though it gets overwritten in the Promise executor.
        let cancel: () => void = () => {}; 
        const racePromise = new Promise<GradeResult | null>((_, reject) => {
            cancel = () => reject(new Error('Dibatalkan Manual atau Timeout'));
            
            // Set timeout trigger
            const timer = setTimeout(() => {
                reject(new Error('Timeout (Batas Waktu Habis)'));
            }, SAFETY_TIMEOUT_MS);

            // Store canceller in state ref mechanism
            setActiveJobCancellers(prev => ({ ...prev, [file.name]: cancel }));
            
            // Cleanup timer if promise settles elsewhere is handled by race logic implicitly
        });

        try {
            const result = await Promise.race([gradingPromise(), racePromise]);
            // Cleanup on success
            setActiveJobCancellers(prev => {
                const newState = { ...prev };
                delete newState[file.name];
                return newState;
            });
            return result;
        } catch (error: any) {
            // Cleanup on failure
            setActiveJobCancellers(prev => {
                const newState = { ...prev };
                delete newState[file.name];
                return newState;
            });

            // Return error result but don't crash the loop
            return {
                fileName: file.name,
                grade: 0,
                detailedFeedback: [],
                improvements: `GAGAL: ${error.message}. Silakan nilai file ini secara manual.`,
                studentText: "Proses dibatalkan atau waktu habis."
            };
        }
    }, [processFilesToParts]);

    /**
     * Pre-check for duplicate files before starting.
     */
    const handleStartCheck = () => {
        const fileNames = studentFiles.map(f => f.name);
        // Find duplicates
        const duplicates = fileNames.filter((item, index) => fileNames.indexOf(item) !== index);
        // Unique list of duplicates
        const uniqueDuplicates = [...new Set(duplicates)];

        if (uniqueDuplicates.length > 0) {
            setDuplicateFiles(uniqueDuplicates);
            setShowDuplicateWarning(true);
        } else {
            handleSubmit();
        }
    };

    /**
     * Handles the submission of the form to start the batch grading process.
     */
    const handleSubmit = useCallback(async () => {
        setShowDuplicateWarning(false); // Ensure modal is closed
        const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());
        if (studentFiles.length === 0 || isLecturerInputMissing) {
            setError("Harap unggah file jawaban mahasiswa dan berikan kunci jawaban dosen.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setResults([]);
        setActiveJobCancellers({});
        abortBatchRef.current = false; // Reset batch abort flag
        
        // --- OPTIMIZED CONCURRENCY STRATEGY ---
        // 5 Workers is the "Sweet Spot".
        // - 10 Workers (Turbo) often hits rate limits (429), triggering backoff, making the total time SLOWER.
        // - 3 Workers (Stable) is safe but slightly slow.
        // - 5 Workers maximizes throughput without aggressive rate limiting.
        const concurrencyLimit = 5;

        const totalSteps = studentFiles.length;
        setProgress({ current: 0, total: totalSteps, message: `Menginisialisasi antrian cerdas...` });

        try {
            const lecturerAnswerPayload: { parts?: any[], text?: string } = {};
            if (answerKeyInputMethod === 'file') {
                 lecturerAnswerPayload.parts = await processFilesToParts(lecturerFiles);
            } else {
                lecturerAnswerPayload.text = lecturerAnswerText;
            }

            // --- WORKER POOL PATTERN ---
            let currentIndex = 0;
            const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

            const worker = async (workerId: number) => {
                while (currentIndex < studentFiles.length) {
                    if (abortBatchRef.current) break;

                    // Atomic capture of index
                    const i = currentIndex++;
                    const file = studentFiles[i];

                    // Process
                    const result = await gradeSingleFile(file, lecturerAnswerPayload);

                    if (abortBatchRef.current) break;

                    if (result) {
                        setResults(prev => [...prev, result]);
                    }

                    // Update progress
                    setProgress(prev => ({
                        ...prev,
                        current: Math.min(prev.current + 1, totalSteps),
                        message: `Menganalisis berkas... (${Math.min(prev.current + 1, totalSteps)}/${totalSteps})`
                    }));

                    // --- INTER-JOB COOL DOWN (CRITICAL OPTIMIZATION) ---
                    // Wait for a random time between 1s and 3s.
                    // This allows the API token bucket to replenish.
                    // Randomness prevents workers from syncing up and hitting the API simultaneously.
                    if (currentIndex < studentFiles.length) {
                        await sleep(1000 + Math.random() * 2000);
                    }
                }
            };

            // Launch workers with a slight stagger
            const workers = [];
            for (let w = 0; w < concurrencyLimit; w++) {
                workers.push(worker(w));
                // Stagger start times by 800ms
                await sleep(800); 
            }

            // Wait for all workers to drain the queue
            await Promise.all(workers);
            
            if (!abortBatchRef.current) {
                setProgress(p => ({ ...p, current: p.total, message: 'Analisis Selesai' }));
                
                // Cleanup after grading is complete.
                setStudentFiles([]); 
                if (!keepLecturerAnswer) {
                    setLecturerFiles([]);
                    setLecturerAnswerText('');
                }
            }
        } catch (err) {
            if (abortBatchRef.current) {
                // Already handled in cancellation logic
            } else {
                setError("Terjadi kesalahan tak terduga selama proses penilaian.");
                console.error(err);
            }
        } finally {
            if (!abortBatchRef.current) {
                setIsLoading(false);
            }
            setActiveJobCancellers({});
        }
    }, [studentFiles, lecturerFiles, answerKeyInputMethod, lecturerAnswerText, gradeSingleFile, keepLecturerAnswer, processFilesToParts]);
    
    /**
     * Generates a CSV file from the grading results and triggers a download.
     */
    const handleDownload = () => {
        const workbook = generateCsv(sortedResults);
        downloadCsv(workbook, 'Hasil-Penilaian-Kelas-PIPB.xlsx');
    };

    // Derived state to check if the lecturer's input is missing.
    const isLecturerInputMissing = (answerKeyInputMethod === 'file' && lecturerFiles.length === 0) || (answerKeyInputMethod === 'text' && !lecturerAnswerText.trim());

    // Get active filenames from the canceller map keys for display
    const activeFileNames = Object.keys(activeJobCancellers);

    // Filter results for stats display (only valid ones)
    const validResultCount = results.filter(r => !r.improvements?.includes("GAGAL") && !r.studentText?.includes("Proses dibatalkan")).length;

    // Determine container classes for the results panel (Dynamic Height)
    const resultsContainerClass = (results.length === 0 && !isLoading) 
        ? "h-full flex flex-col justify-center items-center" 
        : "h-[80vh] lg:h-[85vh] flex flex-col";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Inputs */}
                <div className="space-y-4 p-5 bg-white dark:bg-gray-800 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm transition-colors duration-200">
                     <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b dark:border-gray-700 pb-2 mb-4">Langkah 1: Unggah Berkas Massal</h2>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unggah Semua Jawaban Mahasiswa</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-blue-200 dark:border-blue-800 border-dashed rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="space-y-1 text-center">
                                {studentFiles.length === 0 ? (
                                    <>
                                        <UploadIcon className="mx-auto h-12 w-12 text-blue-400 dark:text-blue-500" />
                                        <label htmlFor="student-file-upload" className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 px-2 pb-1">
                                            <span>Pilih File Kelas</span>
                                            <input id="student-file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                        </label>
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400 font-medium">Mode Kelas: Satu File = Satu Mahasiswa.</p>
                                            <p>Jika menggunakan ZIP, sistem akan mengekstrak dan menilainya sebagai file-file terpisah (Batch).</p>
                                            <p>Format didukung: PDF, Word, Excel, Foto (JPG/PNG), atau ZIP.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <PaperclipIcon className="mx-auto h-12 w-12 text-blue-500" />
                                        <p className="mt-2 text-sm font-medium text-green-600 dark:text-green-400">{studentFiles.length} berkas siap dinilai</p>
                                        <div className="flex justify-center items-center gap-3 mt-3">
                                            <label htmlFor="student-file-upload" className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
                                                Ganti
                                                <input id="student-file-upload" type="file" className="sr-only" onChange={handleStudentFileChange} accept={acceptedFileTypes} multiple />
                                            </label>
                                            <button
                                                onClick={() => setStudentFiles([])}
                                                className="text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                                            >
                                                Hapus Semua
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
                                                className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                                            >
                                                Tempel
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
                            disabled={studentFiles.length === 0 || isLecturerInputMissing} 
                            className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] dark:disabled:from-gray-600 dark:disabled:to-gray-600"
                        >
                             Mulai Penilaian AI untuk {studentFiles.length} Mahasiswa
                        </button>
                    )}
                </div>
                {/* Results Table */}
                 <div className={`p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-blue-200 dark:border-gray-700 shadow-md flex flex-col transition-all duration-500 ease-in-out ${resultsContainerClass}`}>
                    {(results.length > 0 || isLoading) && (
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Rekapitulasi Nilai Kelas</h2>
                            {results.length > 0 && !isLoading && (
                                <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors">
                                    <DownloadIcon className="h-4 w-4 mr-2" />
                                    Unduh Laporan Excel
                                </button>
                            )}
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
                            {/* Active Files Visualization */}
                            {activeFileNames.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Sedang memproses (Klik X untuk lewati):</p>
                                    <div className="flex flex-wrap gap-2">
                                        {activeFileNames.map((name, idx) => (
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
                                <span className="text-xs text-blue-600 dark:text-blue-400 opacity-80">(Rata-rata {(elapsedTime / results.length).toFixed(1)} detik/file)</span>
                            </p>
                        </div>
                    )}
                     {validResultCount > 0 && !isLoading && (
                        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-xs font-bold text-green-800 dark:text-green-300 uppercase">Tertinggi</p>
                                <p className="text-2xl font-extrabold text-green-600 dark:text-green-400">{stats.highest}</p>
                            </div>
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                                <p className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase">Rata-rata</p>
                                <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">{stats.average.toFixed(1)}</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">Terendah</p>
                                <p className="text-2xl font-extrabold text-red-600 dark:text-red-400">{stats.lowest}</p>
                            </div>
                        </div>
                    )}
                    {error && <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded-r-md">{error}</div>}
                    
                    {results.length > 0 ? (
                        <div className="flex-grow overflow-y-auto mt-2 pr-2 custom-scrollbar rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nama Berkas</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Skor Akhir</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Detail</th>
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

             {/* Duplicate Warning Modal */}
             {showDuplicateWarning && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-yellow-300 dark:border-yellow-700 transform transition-all scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Duplikasi File Terdeteksi</h3>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                                Sistem menemukan nama file yang sama dalam unggahan Anda. Jika dilanjutkan, hasil penilaian mungkin akan memiliki nama yang sama dan membingungkan.
                            </p>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                                <p className="text-xs font-bold text-yellow-800 dark:text-yellow-400 mb-1">File duplikat:</p>
                                <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1">
                                    {duplicateFiles.map((name, i) => (
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

            {/* Modal Detail & OCR Verification */}
            {selectedResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in transition-colors duration-200">
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

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6 bg-white dark:bg-gray-800">
                             {/* Score Header */}
                            <div className="text-center p-4 bg-gradient-to-b from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600">
                                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nilai Akhir</span>
                                <div className={`text-6xl font-extrabold ${getGradeColor(selectedResult.grade)} mt-1`}>
                                    {selectedResult.grade}<span className="text-2xl text-gray-400 dark:text-gray-500 font-normal">/100</span>
                                </div>
                            </div>

                            {/* OCR Verification Section - Consistent Toggle with Single Mode */}
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

                             {/* Detailed Feedback */}
                             <div>
                                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2 text-lg border-b dark:border-gray-700 pb-2">
                                    <CheckIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                                    Rincian Analisis Per Soal
                                </h4>
                                <div className="space-y-6">
                                    {selectedResult.detailedFeedback.map((item, idx) => (
                                        <div key={idx} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 transition-all">
                                            <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                                <span className="font-black text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">Soal #{item.questionNumber}</span>
                                                <span className={`text-xl font-bold ${getGradeColor(item.score)}`}>
                                                    {item.score}/100
                                                </span>
                                            </div>

                                            {/* Display Question Text */}
                                            {item.questionText && (
                                                <div className="mb-4">
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 block">Pertanyaan</span>
                                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-400 dark:border-blue-600 text-sm text-blue-900 dark:text-blue-200 font-medium">
                                                        {item.questionText}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Display Lecturer Answer Key */}
                                            {item.lecturerAnswer && (
                                                <div className="mb-4">
                                                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest mb-1 block">Standar Jawaban Dosen</span>
                                                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400 dark:border-green-600 text-sm text-green-900 dark:text-green-200 italic">
                                                        {item.lecturerAnswer}
                                                    </div>
                                                </div>
                                            )}

                                             {/* Display Student Answer Text (OCR per Question) */}
                                             {item.studentAnswer && (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Jawaban Mahasiswa (Terbaca)</span>
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Salinan Lengkap</span>
                                                    </div>
                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 rounded-lg shadow-inner">
                                                        <p className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap leading-relaxed">{item.studentAnswer}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 block">Analisis & Umpan Balik AI</span>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.feedback}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Improvements */}
                            <div className="p-5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50">
                                <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                                    <span className="text-xl">💡</span> Saran Pengembangan Diri
                                </h4>
                                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap pl-8">
                                    {selectedResult.improvements}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
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