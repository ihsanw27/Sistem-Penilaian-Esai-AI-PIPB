
import React, { useState } from 'react';
import { XIcon, UploadIcon, CheckIcon, DownloadIcon } from './icons';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * @component HelpModal
 * @description Modal komprehensif yang menampilkan panduan penggunaan aplikasi dan dokumentasi teknis.
 * Memiliki dua tab: Pengguna (User Guide) dan Pengembang (Developer Docs).
 */
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'user' | 'dev'>('user');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-scale-in">
                
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <span className="text-2xl">📚</span> Pusat Bantuan & Dokumentasi
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'user'
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Panduan Pengguna (Dosen)
                    </button>
                    <button
                        onClick={() => setActiveTab('dev')}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                            activeTab === 'dev'
                                ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                                : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Dokumentasi Pengembang (IT)
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-gray-800 custom-scrollbar">
                    
                    {/* --- TAB PENGGUNA --- */}
                    {activeTab === 'user' && (
                        <div className="space-y-8 max-w-3xl mx-auto">
                            
                            {/* Konsep Dasar */}
                            <section>
                                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4 border-b pb-2 dark:border-gray-700">
                                    🚀 Konsep Dasar
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                                    Sistem ini menggunakan kecerdasan buatan (AI) Generatif terbaru (Gemini 3 Pro) untuk membaca tulisan tangan atau dokumen digital mahasiswa dan menilainya secara otomatis berdasarkan kunci jawaban yang Anda berikan. Sistem menjamin penilaian yang konsisten, objektif, dan transparan.
                                </p>
                            </section>

                            {/* Bagaimana AI Bekerja */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="text-xl">🧠</span> Bagaimana AI Bekerja?
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">1. Pra-pemrosesan Deterministik</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Sistem "Membuka" file ZIP Anda dengan logika baru v4.0. Folder wrapper dibuang. File dalam subfolder dikelompokkan berdasarkan nama folder. File lepas dikelompokkan berdasarkan nama file.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">2. OCR Cache Busting</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Setiap file yang diekstrak diberi sidik jari digital unik. Ini mencegah kesalahan di mana AI "menyangkut" membaca file mahasiswa sebelumnya karena nama file yang sama (misal "page1.jpg").
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">3. Pemahaman Konteks (NLP)</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            AI membaca seluruh dokumen (multi-halaman) sekaligus. Ia tidak butuh nomor soal urut. Ia membaca "isi" jawaban dan mencocokkannya dengan soal yang relevan secara semantik.
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                                        <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">4. Penilaian Deterministik</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            AI membandingkan jawaban siswa dengan kunci dosen poin demi poin. Skor dihitung secara matematis (0-100). Jika jawaban kosong, sistem menandainya sebagai [TIDAK DIKERJAKAN].
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Langkah-Langkah Mode Individu */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm px-2 py-1 rounded">Mode Individu</span>
                                    <span>Langkah Penggunaan</span>
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                                    <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Pilih Mode:</strong> Klik tombol "Mode Individu" di halaman depan.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 1 (Upload Jawaban):</strong> Unggah file jawaban milik <strong>satu mahasiswa</strong>. 
                                            <ul className="pl-6 mt-1 list-disc text-gray-500 dark:text-gray-400 text-xs">
                                                <li>Anda bisa mengunggah banyak file (misal: Halaman 1.jpg, Halaman 2.jpg).</li>
                                                <li>Sistem akan menggabungkan (merge) semua file tersebut menjadi satu kesatuan jawaban.</li>
                                                <li><strong>ZIP Handling:</strong> Jika Anda mengunggah ZIP, semua isinya diekstrak dan digabung menjadi milik 1 mahasiswa ini (Flattened).</li>
                                            </ul>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah file kunci jawaban Dosen atau ketik manual pada kotak teks.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Mulai Penilaian:</strong> Klik tombol "Mulai Penilaian AI". Tunggu proses analisis.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Review Hasil:</strong> Periksa hasil analisis di panel kanan. Klik "Tampilkan Teks" untuk verifikasi OCR.
                                        </li>
                                    </ol>
                                </div>
                            </section>

                             {/* Langkah-Langkah Mode Kelas */}
                             <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm px-2 py-1 rounded">Mode Kelas</span>
                                    <span>Langkah Penggunaan</span>
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                                    <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Pilih Mode:</strong> Klik tombol "Mode Kelas (Massal)".
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 1 (Upload Massal):</strong> Unggah file jawaban seluruh kelas.
                                            <div className="mt-2 ml-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                                                <strong className="block mb-1 text-yellow-800 dark:text-yellow-400">Strategi Upload ZIP Cerdas (v4.0):</strong>
                                                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                                    <li>
                                                        <strong>Folder per Mahasiswa (Paling Aman):</strong> Susun ZIP di mana setiap mahasiswa punya foldernya sendiri ("Andi/", "Budi/"). Sistem akan menggabungkan isi folder menjadi 1 submission per nama folder.
                                                    </li>
                                                    <li>
                                                        <strong>Dokumen Lepas (Flat Files):</strong> Jika ZIP berisi banyak PDF/Word di root, setiap file dianggap sebagai 1 Mahasiswa berbeda. Nama file (tanpa ekstensi) akan jadi nama mahasiswa. Contoh: "Siti Aminah.pdf" -> Mhs "Siti Aminah".
                                                    </li>
                                                    <li>
                                                        <strong>ZIP Individu:</strong> Jika Anda mengunggah ZIP bernama "Budi.zip" yang isinya HANYA gambar-gambar halaman (tanpa folder lain), sistem akan menganggapnya sebagai satu mahasiswa bernama "Budi".
                                                    </li>
                                                    <li>
                                                        <strong>Campuran:</strong> ZIP bisa berisi Folder dan File lepas sekaligus.
                                                    </li>
                                                </ul>
                                            </div>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Verifikasi (Manifest Preview):</strong> <span className="text-green-600 dark:text-green-400 font-bold">[FITUR BARU]</span> Setelah unggah, klik tombol "Lihat Daftar Mahasiswa" yang muncul. Pastikan nama-nama mahasiswa terdeteksi dengan benar dan jumlah filenya sesuai. Ini untuk menghindari kesalahan input (misal: File A masuk folder B).
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah kunci jawaban Dosen (berlaku untuk seluruh kelas).
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Eksekusi:</strong> Klik "Mulai Penilaian AI untuk X Mahasiswa".
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Monitoring:</strong> Pantau progress bar. Sistem memproses 5 mahasiswa sekaligus. Jika macet >15 menit, Anda bisa klik (x) untuk skip manual.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Selesai:</strong> Unduh Excel laporan. Gunakan Modal Detail untuk melihat perbandingan Soal vs Kunci vs Jawaban Siswa.
                                        </li>
                                    </ol>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    💡 Tips & Trik
                                </h3>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                                    <li><strong>Verifikasi OCR:</strong> Selalu lakukan pengecekan acak (spot check). Klik tombol "Detail" pada hasil siswa, lalu klik "Tampilkan Teks" untuk melihat apa yang dibaca AI.</li>
                                    <li><strong>Jawaban Kosong:</strong> Jika AI memberikan nilai 0 dan tulisan [TIDAK DIKERJAKAN], cek visual file aslinya. Mungkin tulisannya terlalu kabur atau halaman kosong.</li>
                                    <li><strong>Internet Stabil:</strong> Mode Kelas membutuhkan koneksi internet yang stabil karena mengirim banyak data secara paralel.</li>
                                </ul>
                            </section>
                        </div>
                    )}

                    {/* --- TAB DEVELOPER --- */}
                    {activeTab === 'dev' && (
                        <div className="space-y-8 max-w-3xl mx-auto font-mono text-sm">
                            <div className="p-4 bg-gray-900 text-green-400 rounded-lg border border-gray-700">
                                <p className="mb-2">// Tech Stack</p>
                                <ul className="list-none space-y-1 ml-4 text-gray-300">
                                    <li>Frontend: React 19 + TypeScript</li>
                                    <li>Styling: Tailwind CSS (Dark Mode supported)</li>
                                    <li>AI SDK: @google/genai (Gemini 3 Pro Preview)</li>
                                    <li>Utils: xlsx (Excel Export), jszip (Archive handling), mammoth (Word parsing)</li>
                                </ul>
                            </div>

                            <section>
                                <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 mb-3">
                                    🏗️ Arsitektur Sistem & Logika Bisnis
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans">
                                    <div>
                                        <h4 className="font-bold">1. File Processing & Cache Busting (`utils/fileUtils.ts`)</h4>
                                        <p>Logika Deep Fix v4.0 untuk mengatasi konsistensi OCR.</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                            <li><strong>Nuclear Cache Busting:</strong> Setiap file yang diekstrak dari ZIP di-rename secara internal menjadi `Path_Filename_TIMESTAMP_RANDOM`. Ini memaksa browser dan Gemini API melihatnya sebagai objek unik, mencegah browser memberikan cache blob mahasiswa sebelumnya.</li>
                                            <li><strong>Deterministic Grouping:</strong> Logika penentuan nama mahasiswa tidak lagi menebak-nebak, tetapi secara ketat mengikuti struktur folder atau nama file setelah stripping common root.</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">2. Grading Service (`services/geminiService.ts`)</h4>
                                        <p>Menggunakan <code>gemini-3-pro-preview</code>. Prompt dirancang dengan teknik <em>Chain-of-Thought</em> implisit dan instruksi deterministik.</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1">
                                            <li><strong>Stateless Architecture:</strong> Klien <code>GoogleGenAI</code> diinstansiasi di dalam fungsi <code>gradeAnswer</code> (bukan global). Ini mencegah "Data Bleeding" atau kebocoran state antar request paralel.</li>
                                            <li><strong>Strict Verbatim Rule:</strong> AI dipaksa menyalin teks asli siswa (OCR) ke dalam JSON output untuk transparansi.</li>
                                            <li><strong>Retry Strategy:</strong> Menggunakan <em>Exponential Backoff</em> dengan Jitter untuk menangani HTTP 429 saat batch processing.</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">3. Batch Concurrency (`components/ClassMode.tsx`)</h4>
                                        <p>Menggunakan pola <strong>Worker Pool</strong> (bukan Promise.all sederhana). </p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1">
                                            <li><strong>Concurrency Limit:</strong> 5 Worker.</li>
                                            <li><strong>Staggered Start:</strong> Jeda 800ms antar worker start untuk mencegah lonjakan request awal.</li>
                                            <li><strong>Inter-job Cooldown:</strong> Jeda acak antar tugas untuk mendinginkan Rate Limiter.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 mb-3">
                                    ⚠️ Known Issues & Mitigations
                                </h3>
                                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 font-sans">
                                    <li>
                                        <strong>Rate Limits (429):</strong> Gemini API memiliki batas RPM. Sistem mengatasinya dengan retries dan reduced concurrency (5).
                                    </li>
                                    <li>
                                        <strong>Browser Memory:</strong> Memproses ZIP besar (>500MB) bisa membuat browser crash. Disarankan memecah ZIP jika terlalu besar.
                                    </li>
                                </ul>
                            </section>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        Tutup Panduan
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
