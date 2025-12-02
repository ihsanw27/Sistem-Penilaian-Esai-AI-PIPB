
import React from 'react';

interface AILoaderProps {
    status?: string;
    subStatus?: string;
}

/**
 * @component AILoader
 * @description A visually appealing, animated loader designed specifically for AI processing states.
 * It uses gradients and pulse effects to mimic "AI Thinking" (Gemini style) rather than a generic spinner.
 */
const AILoader: React.FC<AILoaderProps> = ({ 
    status = "AI Sedang Berpikir...", 
    subStatus = "Menganalisis konteks dokumen dan menilai jawaban..." 
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 w-full">
            <div className="relative w-24 h-24 mb-6">
                {/* 1. Outer Glowing Pulse (Breathing effect) */}
                <div className="absolute inset-0 bg-blue-400 dark:bg-blue-600 rounded-full opacity-20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                
                {/* 2. Rotating Gradient Ring (Clockwise) */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-indigo-500 p-1 animate-[spin_3s_linear_infinite]">
                    {/* Inner Mask to create the ring effect */}
                    <div className="h-full w-full bg-white dark:bg-gray-800 rounded-full"></div>
                </div>

                {/* 3. Central Icon Container */}
                <div className="absolute inset-2 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden shadow-inner">
                    {/* 4. The "Sparkle" / AI Core Icon */}
                    <svg 
                        className="w-10 h-10 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 animate-pulse"
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        {/* Gemini-like sparkle shape */}
                        <path d="M12 2C12.5523 7 16 9.5 21 10C16 10.5 13 14 12 19C11 14 7 11 2 10C7 9.5 10.5 6 12 2Z" />
                    </svg>
                </div>

                {/* 5. Orbiting Particle (Now Clockwise) */}
                <div className="absolute top-0 left-1/2 -ml-1 w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-[spin_4s_linear_infinite] origin-[50%_48px]"></div>
            </div>

            {/* Status Text */}
            <div className="text-center space-y-2 max-w-sm animate-fade-in">
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-600 dark:from-blue-300 dark:to-purple-300">
                    {status}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {subStatus}
                </p>
            </div>
        </div>
    );
};

export default AILoader;
