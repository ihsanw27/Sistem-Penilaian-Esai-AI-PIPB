
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, CheckIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AVAILABLE_MODELS = [
    { 
        id: 'gemini-3-pro-preview', 
        name: 'Gemini 3 Pro (Cerdas)', 
        desc: 'Akurasi dan penalaran tertinggi. Ideal untuk esai kompleks. Gunakan batas konkurensi 2 pada akun gratis.' 
    },
    { 
        id: 'gemini-2.5-flash', 
        name: 'Gemini 2.5 Flash (Seimbang)', 
        desc: 'Keseimbangan optimal antara kecepatan dan akurasi. Pilihan alternatif yang stabil.' 
    },
    { 
        id: 'gemini-2.0-flash', 
        name: 'Gemini 2.0 Flash (Cepat)', 
        desc: 'Pemrosesan berkecepatan tinggi. Cocok untuk penilaian massal dengan volume besar.' 
    }
];

/**
 * @component SettingsModal
 * @description Modal konfigurasi pengguna untuk mengelola preferensi API Key dan Model AI.
 * 
 * FUNGSI UTAMA:
 * 1. Manajemen API Key (BYOK): Menyimpan kunci pengguna di LocalStorage.
 * 2. Pemilihan Model: Mengizinkan pengguna beralih antara model sesuai kebutuhan.
 * 3. Kontrol Konkurensi (Advanced): Pengaturan batas worker pool.
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-3-pro-preview');
    const [concurrencyLimit, setConcurrencyLimit] = useState<number>(2);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('USER_GEMINI_API_KEY') || '';
            const savedModel = localStorage.getItem('USER_GEMINI_MODEL') || 'gemini-3-pro-preview';
            const savedConcurrency = parseInt(localStorage.getItem('USER_CONCURRENCY_LIMIT') || '2', 10);
            
            setApiKey(savedKey);
            setSelectedModel(savedModel);
            setConcurrencyLimit(savedConcurrency);
            setIsSaved(false);
            setShowAdvanced(false);
        }
    }, [isOpen]);

    const handleSave = () => {
        if (apiKey.trim()) {
            localStorage.setItem('USER_GEMINI_API_KEY', apiKey.trim());
        } else {
            localStorage.removeItem('USER_GEMINI_API_KEY');
        }
        
        localStorage.setItem('USER_GEMINI_MODEL', selectedModel);
        localStorage.setItem('USER_CONCURRENCY_LIMIT', concurrencyLimit.toString());
        
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1000);
    };

    const handleClearKey = () => {
        setApiKey('');
        localStorage.removeItem('USER_GEMINI_API_KEY');
    };

    if (!isOpen) return null;

    const showConcurrencyWarning = !apiKey && concurrencyLimit > 2;

    return createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-scale-in">
                
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span>⚙️</span> Pengaturan
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    
                    {/* API Key Section */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Gemini API Key (Opsional)
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                            Gunakan API Key pribadi untuk melewati batasan kuota server default dan meningkatkan stabilitas.
                        </p>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Tempel API Key (AIza...)"
                                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
                            />
                            {apiKey && (
                                <button 
                                    onClick={handleClearKey}
                                    className="absolute right-3 top-3 text-xs text-red-500 hover:text-red-700 font-bold"
                                >
                                    Hapus
                                </button>
                            )}
                        </div>
                        <div className="mt-2 text-right">
                            <a 
                                href="https://aistudio.google.com/app/apikey" 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                            >
                                Dapatkan API Key &rarr;
                            </a>
                        </div>
                    </div>

                    {/* Model Selection Section */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Pilih Model AI
                        </label>
                        <div className="space-y-3">
                            {AVAILABLE_MODELS.map((model) => (
                                <label 
                                    key={model.id}
                                    className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${selectedModel === model.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="ai_model"
                                        value={model.id}
                                        checked={selectedModel === model.id}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <div className="ml-3">
                                        <span className={`block text-sm font-bold ${selectedModel === model.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {model.name}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                            {model.desc}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Advanced Settings Toggle */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                         <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1 focus:outline-none"
                        >
                            <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                            Opsi Lanjutan
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 animate-fade-in">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    Batas Konkurensi (Worker Pool)
                                </label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="10" 
                                        step="1"
                                        value={concurrencyLimit}
                                        onChange={(e) => setConcurrencyLimit(parseInt(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                                    />
                                    <span className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400 w-8 text-center">
                                        {concurrencyLimit}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Jumlah proses paralel. Default: 2 (Optimal untuk Free Tier).
                                </p>

                                {showConcurrencyWarning && (
                                    <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-xs text-yellow-800 dark:text-yellow-300">
                                        <strong>⚠️ Peringatan:</strong> Konkurensi &gt; 2 berisiko menyebabkan error "Too Many Requests" pada akun gratis.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaved}
                        className={`px-6 py-2 text-white rounded-lg font-bold transition-all shadow-sm flex items-center gap-2 ${isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSaved ? (
                            <>
                                <CheckIcon className="w-5 h-5" />
                                Tersimpan
                            </>
                        ) : (
                            'Simpan'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsModal;
