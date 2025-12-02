import React, { useState, useEffect } from 'react';
import GradingDashboard from './components/GradingDashboard';
import { SunIcon, MoonIcon, QuestionMarkIcon } from './components/icons';
import HelpModal from './components/HelpModal';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

/**
 * The main application component.
 * It sets up the overall layout, header, and footer, and renders the main GradingDashboard.
 * @returns {React.ReactElement} The rendered App component.
 */
const App: React.FC = () => {
  // State for Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Check local storage or system preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') return true;
      if (savedTheme === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // State for Help Modal
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // RECAPTCHA SITE KEY
  // Ensure this is set in your environment variables.
  const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || "";

  // Apply 'dark' class to html element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Listen for system theme changes dynamically
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only follow system if user hasn't manually set a preference in localStorage
      if (!localStorage.getItem('theme')) {
        setIsDark(e.matches);
      }
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    // When user manually toggles, persist this preference to override system defaults
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  return (
    <GoogleReCaptchaProvider 
        reCaptchaKey={RECAPTCHA_SITE_KEY}
        scriptProps={{
            async: false,
            defer: false,
            appendTo: "head",
            nonce: undefined,
        }}
    >
        <div className="min-h-screen bg-sky-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 transition-colors duration-200">
        <div className="w-full max-w-5xl mx-auto relative">
            
            {/* Top Right Controls (Dark Mode & Help) */}
            <div className="absolute top-0 right-0 z-50 flex gap-2">
                <button
                    onClick={() => setIsHelpOpen(true)}
                    className="p-2 rounded-full bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all shadow-sm backdrop-blur-sm group"
                    title="Bantuan & Dokumentasi"
                >
                    <QuestionMarkIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                </button>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all shadow-sm backdrop-blur-sm"
                    title={isDark ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
                >
                    {isDark ? (
                        <SunIcon className="w-6 h-6 text-yellow-400" />
                    ) : (
                        <MoonIcon className="w-6 h-6 text-slate-600" />
                    )}
                </button>
            </div>

            <header className="text-center mb-8 pt-4">
            {/* Campus Logo */}
            <div className="flex justify-center mb-6 items-center flex-col">
                <img 
                src="https://lh3.googleusercontent.com/d/1Cdi9gy2nakntWWtg0U3_uKi_Hdplhhfu" 
                alt="Logo Politeknik Industri Petrokimia Banten" 
                referrerPolicy="no-referrer"
                className="h-24 sm:h-32 object-contain drop-shadow-md hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = document.getElementById('logo-fallback');
                    if (fallback) fallback.classList.remove('hidden');
                }}
                />
                {/* Fallback Logo if image fails to load */}
                <div id="logo-fallback" className="hidden flex items-center justify-center h-24 w-24 sm:h-32 sm:w-32 bg-white rounded-full border-4 border-blue-900 shadow-lg">
                    <span className="text-blue-900 font-black text-xl sm:text-2xl tracking-tighter">PIPB</span>
                </div>
            </div>

            {/* Application Title and Subtitle */}
            <h1 className="text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-sky-600 dark:from-blue-400 dark:to-sky-300 pb-2">
                Sistem Penilaian Esai AI PIPB
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Platform asisten penilaian cerdas untuk Politeknik Industri Petrokimia Banten.
                <br/>
                <span className="text-sm text-gray-500 dark:text-gray-400">Menggunakan teknologi Gemini 3 Pro untuk evaluasi yang objektif, konsisten, dan transparan.</span>
            </p>
            </header>

            <main className="w-full">
            {/* Main content area containing the grading dashboard */}
            <div className="mt-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-blue-200 dark:border-gray-700 rounded-xl shadow-xl p-6 min-h-[60vh] transition-colors duration-200">
                <GradingDashboard />
            </div>
            </main>
            
            <footer className="text-center mt-10 text-gray-400 dark:text-gray-500 text-sm pb-4">
            <p>&copy; {new Date().getFullYear()} Politeknik Industri Petrokimia Banten. Didukung oleh Google Gemini API.</p>
            </footer>

            {/* Global Help Modal */}
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
        </div>
    </GoogleReCaptchaProvider>
  );
};

export default App;