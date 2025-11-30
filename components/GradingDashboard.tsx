import React, { useState } from 'react';
import SingleStudentGrader from './GradingSystem'; // Corrected from SingleStudentGrader to GradingSystem
import ClassMode from './ClassMode';

/**
 * GradingDashboard component that acts as a container for the grading system.
 * It provides a toggle to switch between 'Single Student' mode and 'Class' mode.
 * @returns {React.ReactElement} The rendered GradingDashboard component.
 */
const GradingDashboard: React.FC = () => {
    // State to manage the current active mode: 'single' or 'class'.
    const [mode, setMode] = useState<'single' | 'class'>('single');

    return (
        <div className="space-y-6">
            {/* Mode switcher UI */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-2xl mx-auto mb-8">
                <button
                    onClick={() => setMode('single')}
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
                    onClick={() => setMode('class')}
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
            
            {/* Conditional rendering based on the selected mode */}
            <div className="mt-4 animate-fade-in">
                {mode === 'single' ? <SingleStudentGrader /> : <ClassMode />}
            </div>
        </div>
    );
};

export default GradingDashboard;