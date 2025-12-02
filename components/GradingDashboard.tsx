
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import GradingSystem from './GradingSystem';
import ClassMode from './ClassMode';

/**
 * @component GradingDashboard
 * @description Komponen kontainer utama untuk sistem penilaian.
 * Menggunakan React Portal untuk modal konfirmasi.
 */
const GradingDashboard: React.FC = () => {
    // State untuk mengelola mode aktif saat ini: 'single' atau 'class'.
    const [mode, setMode] = useState<'single' | 'class'>('single');
    
    // State untuk melacak apakah mode aktif saat ini memiliki data (file/hasil).
    const [isDirty, setIsDirty] = useState<boolean>(false);
    
    // State untuk mengelola visibilitas modal konfirmasi ganti mode.
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    
    // State sementara untuk menyimpan mode target yang diinginkan pengguna saat modal muncul.
    const [pendingMode, setPendingMode] = useState<'single' | 'class' | null>(null);

    /**
     * Callback yang diteruskan ke komponen anak (GradingSystem/ClassMode).
     * Anak memanggil ini untuk memberi tahu Dashboard apakah mereka memiliki data.
     */
    const handleDataDirty = useCallback((hasData: boolean) => {
        setIsDirty(hasData);
    }, []);

    /**
     * Menangani permintaan pengguna untuk mengganti mode.
     */
    const requestModeSwitch = (targetMode: 'single' | 'class') => {
        if (mode === targetMode) return; // Tidak ada perubahan

        if (isDirty) {
            setPendingMode(targetMode);
            setShowConfirmModal(true);
        } else {
            setMode(targetMode);
        }
    };

    /**
     * Mengonfirmasi pergantian mode (pengguna setuju data hilang).
     */
    const confirmSwitch = () => {
        if (pendingMode) {
            setMode(pendingMode);
            setIsDirty(false); // Reset status dirty untuk mode baru
            setPendingMode(null);
        }
        setShowConfirmModal(false);
    };

    return (
        <div className="space-y-6">
            {/* UI Pengalih Mode (Switcher) */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-2xl mx-auto mb-8">
                <button
                    onClick={() => requestModeSwitch('single')}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        mode === 'single' 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400 shadow-md transform scale-[1.02]' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-gray-700'
                    }`}
                >
                    <div className={`font-bold text-lg ${mode === 'single' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        Mode Individu
                    </div>
                    <div className={`text-xs mt-1 ${mode === 'single' ? 'text-blue-600/80 dark:text-blue-300/70' : 'text-gray-500 dark:text-gray-500'}`}>
                        Nilai satu mahasiswa secara mendalam. Cocok untuk review detail.
                    </div>
                </button>
                
                <button
                    onClick={() => requestModeSwitch('class')}
                    className={`flex-1 p-4 rounded-xl border-2 text-center transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        mode === 'class' 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400 shadow-md transform scale-[1.02]' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-gray-700'
                    }`}
                >
                    <div className={`font-bold text-lg ${mode === 'class' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        Mode Kelas (Massal)
                    </div>
                    <div className={`text-xs mt-1 ${mode === 'class' ? 'text-blue-600/80 dark:text-blue-300/70' : 'text-gray-500 dark:text-gray-500'}`}>
                        Nilai banyak file sekaligus. Hemat waktu dengan pemrosesan paralel.
                    </div>
                </button>
            </div>
            
            {/* Render Kondisional berdasarkan mode yang dipilih */}
            <div className="mt-4 animate-fade-in">
                {mode === 'single' ? (
                    <GradingSystem onDataDirty={handleDataDirty} />
                ) : (
                    <ClassMode onDataDirty={handleDataDirty} />
                )}
            </div>

            {/* Modal Konfirmasi Ganti Mode - PORTAL */}
            {showConfirmModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Ganti Mode Penilaian?</h3>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Anda memiliki data (file atau hasil penilaian) yang sedang aktif di mode ini.
                            </p>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-2">
                                Jika Anda berpindah mode, semua data saat ini akan di-reset (hilang).
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            >
                                Batal (Tetap di Sini)
                            </button>
                            <button
                                onClick={confirmSwitch}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors shadow-sm"
                            >
                                Ya, Ganti & Reset
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default GradingDashboard;
