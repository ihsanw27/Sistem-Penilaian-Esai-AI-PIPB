
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, CheckIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AVAILABLE_MODELS = [
    { 
        id: 'gemini-2.0-flash', 
        name: 'Gemini 2.0 Flash (Recommended)', 
        desc: 'Cepat, Gratis, dan Stabil. Pilihan terbaik untuk Mode Kelas (Massal) tanpa limit ketat.' 
    },
    { 
        id: 'gemini-3-pro-preview', 
        name: 'Gemini 3 Pro (High Intelligence)', 
        desc: 'Kecerdasan tertinggi, tapi lambat. Rawan error limit (429) pada akun gratis. Gunakan hanya untuk Mode Individu.' 
    }
];

/**
 * @component SettingsModal
 * @description Modal untuk konfigurasi pengguna (API Key custom dan Pemilihan Model).
 * Menggunakan localStorage untuk persistensi.
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    // Default to Flash for better free tier experience
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [isSaved, setIsSaved] = useState(false);

    // Load saved settings on mount
    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('USER_GEMINI_API_KEY') || '';
            const savedModel = localStorage.getItem('USER_GEMINI_MODEL') || 'gemini-2.0-flash';
            setApiKey(savedKey);
            setSelectedModel(savedModel);
            setIsSaved(false);
        }
    }, [isOpen]);

    const handleSave = () => {
        if (apiKey.trim()) {
            localStorage.setItem('USER_GEMINI_API_KEY', apiKey.trim());
        } else {
            localStorage.removeItem('USER_GEMINI_API_KEY');
        }
        
        localStorage.setItem('USER_GEMINI_MODEL', selectedModel);
        
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
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    
                    {/* API Key Section */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Gemini API Key (Opsional)
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                            Secara default, aplikasi menggunakan kunci server bersama (Free Tier terbatas). 
                            Masukkan kunci Anda sendiri untuk performa lebih cepat dan limit lebih tinggi.
                        </p>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Tempel API Key Anda di sini (AIza...)"
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
                                Dapatkan API Key di sini &rarr;
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
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {model.desc}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
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
                            'Simpan Pengaturan'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SettingsModal;
