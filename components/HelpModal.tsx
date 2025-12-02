
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
                                    Sistem ini menggunakan kecerdasan buatan (AI) untuk membaca tulisan tangan atau dokumen digital mahasiswa dan menilainya secara otomatis berdasarkan kunci jawaban yang Anda berikan. Sistem menjamin penilaian yang konsisten dan objektif.
                                </p>
                            </section>

                            {/* Bagian Baru: Bagaimana AI Bekerja */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="text-xl">🧠</span> Bagaimana AI Bekerja?
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">1. Pra-pemrosesan File</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Sistem membaca file ZIP atau dokumen Office. Jika ada folder di dalam ZIP (Mode Kelas), sistem otomatis mengelompokkannya sebagai satu mahasiswa. Teks digital diekstrak langsung untuk akurasi 100%.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">2. OCR & Visi Komputer</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Untuk gambar tulisan tangan, model AI (Gemini 3 Pro) "melihat" gambar dan mengubahnya menjadi teks digital (OCR), mengenali pola tulisan yang sulit sekalipun.
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">3. Pemahaman Konteks (NLP)</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            AI membaca seluruh dokumen untuk menemukan jawaban yang relevan, meskipun urutan soal acak. Ia membandingkan makna jawaban siswa dengan kunci jawaban dosen secara semantik.
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                                        <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">4. Penilaian & Umpan Balik</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Skor diberikan berdasarkan kriteria dosen. AI menyusun umpan balik per soal dan saran perbaikan, lalu menyajikannya dalam tabel atau Excel.
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
                                                <li>Sistem akan menggabungkan semua file tersebut menjadi satu kesatuan jawaban.</li>
                                                <li><strong>ZIP Handling:</strong> Jika Anda mengunggah ZIP, semua isinya diekstrak dan digabung menjadi milik 1 mahasiswa ini.</li>
                                            </ul>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah file kunci jawaban Dosen atau ketik manual pada kotak teks yang tersedia.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Mulai Penilaian:</strong> Klik tombol "Mulai Penilaian AI". Tunggu beberapa saat hingga proses selesai.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Review Hasil:</strong> Periksa hasil analisis di panel kanan (Skor, Koreksi Per Soal, dan Saran).
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
                                                <strong className="block mb-1 text-yellow-800 dark:text-yellow-400">Strategi Upload ZIP (PENTING):</strong>
                                                <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                                    <li>
                                                        <strong>Opsi A (Folder per Mahasiswa):</strong> Gunakan struktur folder. Buat folder "Ahmad", "Budi", dll. Masukkan file ke masing-masing folder. ZIP folder induknya. Sistem membaca nama folder sebagai nama mahasiswa.
                                                    </li>
                                                    <li>
                                                        <strong>Opsi B (File Datar):</strong> Jika 1 mahasiswa = 1 File (misal PDF), blok semua file dan ZIP. Sistem otomatis menggunakan nama file (misal: "Budi.pdf" menjadi mahasiswa "Budi") dengan menghapus ekstensinya agar rapi.
                                                    </li>
                                                    <li>
                                                        <strong>Opsi C (Campuran):</strong> Anda bisa mencampur folder dan file lepas dalam satu ZIP. Sistem akan mendeteksi keduanya secara otomatis.
                                                    </li>
                                                </ul>
                                            </div>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah kunci jawaban Dosen (berlaku untuk seluruh kelas).
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Eksekusi:</strong> Klik "Mulai Penilaian AI untuk X Mahasiswa".
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Monitoring:</strong> Pantau progress bar. Jika ada file macet, klik tanda <strong>(x)</strong> untuk melewatinya.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Selesai:</strong> Unduh rekapitulasi nilai dan analisis detail dalam format Excel (.xlsx).
                                        </li>
                                    </ol>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    📂 Format File yang Didukung
                                </h3>
                                <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <CheckIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Dokumen Digital:</strong> Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PDF.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Gambar / Scan:</strong> JPG, PNG, HEIC. (Pastikan tulisan terbaca jelas).</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Arsip:</strong> ZIP (Sangat disarankan untuk Mode Kelas). Mendukung campuran file dan folder.</span>
                                    </li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    💡 Tips & Trik
                                </h3>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                                    <li><strong>Kunci Jawaban Teks Manual:</strong> Untuk soal esai pendek, mengetik kunci jawaban secara manual di kotak teks seringkali memberikan hasil lebih akurat daripada mengunggah file kunci yang rumit.</li>
                                    <li><strong>Verifikasi OCR:</strong> Jika nilai terasa aneh, klik tombol "Tampilkan Teks" pada hasil penilaian untuk melihat apa yang sebenarnya dibaca oleh AI.</li>
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
                                    🏗️ Arsitektur Sistem
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans">
                                    <div>
                                        <h4 className="font-bold">1. Grading Logic (`services/geminiService.ts`)</h4>
                                        <p>Menggunakan strategi <em>One-Shot Prompting</em> dengan instruksi sistem yang deterministik (Temperature 0). Menggunakan model <code>gemini-3-pro-preview</code> untuk kemampuan nalar dan OCR tertinggi. Skema JSON ketat digunakan untuk memastikan output terstruktur.</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">2. Batch Processing (`components/ClassMode.tsx`)</h4>
                                        <p>Menggunakan pola <strong>Worker Pool</strong> dengan konkurensi terbatas (default: 5 worker). Setiap worker mengambil job dari antrian secara asinkron. Terdapat mekanisme <em>Jitter/Staggered Start</em> untuk menghindari <em>Rate Limit (429)</em> API Google.</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">3. File Handling & ZIP Heuristics (`utils/fileUtils.ts`)</h4>
                                        <p>Sistem memiliki logika parser ZIP cerdas (<code>processClassFiles</code>). Ia memindai struktur path ZIP:</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1">
                                            <li><strong>Common Root Detection:</strong> Jika semua file ada dalam satu folder induk, folder itu diabaikan.</li>
                                            <li><strong>Folder-based Grouping:</strong> Jika terdeteksi folder level-2 (misal "Budi/.."), file dikelompokkan sebagai <code>StudentSubmission</code> milik "Budi".</li>
                                            <li><strong>Flat File Handling:</strong> Jika file berada di root (atau mixed), nama file digunakan sebagai nama siswa. Ekstensi file otomatis dihapus (misal: "Budi.pdf" -> "Budi") untuk konsistensi nama.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 mb-3">
                                    ⚠️ Catatan Maintenance
                                </h3>
                                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 font-sans">
                                    <li>
                                        <strong>API Key:</strong> Pastikan <code>process.env.API_KEY</code> dikonfigurasi di environment deployment. Jangan hardcode di frontend.
                                    </li>
                                    <li>
                                        <strong>Rate Limits:</strong> Jika sering terjadi error 429 pada deployment skala besar, pertimbangkan untuk menurunkan konkurensi di <code>ClassMode.tsx</code> atau menggunakan API Key tier berbayar.
                                    </li>
                                    <li>
                                        <strong>Timeout:</strong> Sistem memiliki <em>Safety Net Timeout</em> 15 menit per file untuk mencegah hanging.
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
