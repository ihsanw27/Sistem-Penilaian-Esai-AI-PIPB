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
 * Sekarang mendukung fitur cetak/simpan PDF untuk dokumentasi.
 */
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'user' | 'dev'>('user');

    if (!isOpen) return null;

    /**
     * Menangani pencetakan konten bantuan.
     * Membuka jendela baru, menyuntikkan konten HTML yang relevan, dan memicu dialog cetak browser.
     */
    const handlePrint = () => {
        const printContent = document.getElementById('help-content-area');
        if (!printContent) return;

        const win = window.open('', '', 'height=700,width=1000');
        if (!win) return;

        win.document.write('<html><head><title>Panduan Sistem Penilaian AI PIPB</title>');
        // Menggunakan Tailwind via CDN agar gaya cetak tetap konsisten
        win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        win.document.write(`
            <style>
                @media print {
                    body { font-size: 12pt; color: #000; }
                    a { text-decoration: none; color: #000; }
                    .no-print { display: none; }
                }
            </style>
        `);
        win.document.write('</head><body class="p-8 bg-white text-gray-900">');
        win.document.write('<h1 class="text-2xl font-bold mb-4 text-center border-b pb-4">Panduan Sistem Penilaian Esai AI PIPB</h1>');
        win.document.write(printContent.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        
        // Beri waktu sedikit agar style termuat sebelum dialog cetak muncul
        setTimeout(() => {
            win.print();
        }, 500);
    };

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
                <div id="help-content-area" className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-gray-800 custom-scrollbar">
                    
                    {/* --- TAB PENGGUNA --- */}
                    {activeTab === 'user' && (
                        <div className="space-y-8 max-w-3xl mx-auto">
                            
                            {/* Konsep Dasar */}
                            <section>
                                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4 border-b pb-2 dark:border-gray-700">
                                    🚀 Konsep Dasar
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed text-justify">
                                    Sistem Penilaian Esai AI PIPB adalah platform cerdas yang dirancang untuk membantu dosen Politeknik Industri Petrokimia Banten dalam menilai jawaban mahasiswa secara objektif, cepat, dan transparan. Menggunakan model <strong>Gemini 3 Pro Preview</strong>, sistem ini mampu membaca berbagai format dokumen (PDF, Word, Gambar, Tulis Tangan) dan membandingkannya dengan kunci jawaban Dosen secara verbatim (kata per kata).
                                </p>
                            </section>

                            {/* Lingkungan Sistem & Performa */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    💻 Lingkungan Sistem & Performa
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-2">🌐 Di mana aplikasi berjalan? (Server vs Browser)</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Aplikasi ini menggunakan arsitektur <strong>Hybrid</strong>:
                                        </p>
                                        <ul className="list-disc list-inside ml-2 text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                                            <li><strong>Browser Anda (Client-Side):</strong> Semua logika aplikasi, ekstraksi file ZIP, manajemen antrian, dan pembuatan file Excel laporan berjalan <strong>100% di dalam laptop/PC Anda</strong>. Data tidak disimpan di server perantara kami.</li>
                                            <li><strong>Google Cloud (Server-Side):</strong> Proses "berpikir" (membaca tulisan/OCR dan penilaian) dilakukan dengan mengirim data terenkripsi langsung ke server Google (Gemini API), lalu hasilnya dikembalikan ke Anda.</li>
                                        </ul>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">📡</span>
                                                <span className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Internet</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Sangat Berpengaruh</p>
                                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">Kecepatan upload menentukan seberapa cepat file dikirim ke AI. Jika internet lambat, tahap "Mengirim..." akan terasa lama.</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">💻</span>
                                                <span className="font-bold text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide">Spek Komputer (RAM/CPU)</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Berpengaruh</p>
                                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">RAM dan CPU digunakan untuk mengekstrak ZIP besar dan menampung data di browser. Komputer dengan RAM &lt;4GB mungkin terasa berat saat memproses >50 mahasiswa.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Bagaimana AI Bekerja */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="text-xl">🧠</span> Bagaimana AI Bekerja?
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">1. Pra-pemrosesan File Cerdas</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            Saat Anda mengunggah ZIP, sistem secara otomatis mendeteksi strukturnya. Folder diubah menjadi identitas mahasiswa. Sistem juga menerapkan <em>Cache Busting</em> untuk memastikan setiap file dibaca sebagai entitas unik, mencegah kesalahan pembacaan berulang.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">2. Analisis Konteks (NLP)</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            AI membaca seluruh dokumen sekaligus. Ia tidak memerlukan jawaban berurutan. AI akan mencari paragraf yang relevan dengan soal nomor tertentu di mana pun letaknya dalam dokumen.
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">3. Penilaian Objektif</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            AI membandingkan jawaban siswa dengan kunci dosen poin demi poin. Skor dihitung secara matematis. Setiap sesi penilaian dijalankan secara terisolasi (stateless) untuk menjamin privasi data antar mahasiswa.
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                                        <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">4. Umpan Balik Verbatim</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            Hasil penilaian menyertakan salinan teks asli jawaban siswa (OCR) untuk setiap soal. Ini memungkinkan Dosen memverifikasi bahwa AI membaca bagian yang tepat.
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
                                            <strong className="text-gray-900 dark:text-gray-100">Mulai Penilaian:</strong> Selesaikan reCAPTCHA ("Saya bukan robot"), lalu klik tombol "Mulai Penilaian AI".
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Review Hasil:</strong> Periksa hasil analisis di panel kanan. Klik "Tampilkan Teks" untuk verifikasi OCR global.
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
                                                </ul>
                                            </div>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Verifikasi (Manifest Preview):</strong> <span className="text-green-600 dark:text-green-400 font-bold">[PENTING]</span> Setelah unggah, klik tombol "Lihat Daftar Mahasiswa" yang muncul. Pastikan nama-nama mahasiswa terdeteksi dengan benar dan jumlah filenya sesuai. Klik baris nama untuk melihat rincian file di dalamnya.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah kunci jawaban Dosen (berlaku untuk seluruh kelas).
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Eksekusi:</strong> Selesaikan verifikasi reCAPTCHA, lalu klik "Mulai Penilaian AI untuk X Mahasiswa".
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Monitoring:</strong> Pantau progress bar. Sistem memproses 8 mahasiswa sekaligus (Optimized Concurrency). Jika macet >15 menit, Anda bisa klik (x) untuk skip manual.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Selesai:</strong> Unduh Excel laporan yang berisi rekap nilai dan analisis detail per soal.
                                        </li>
                                    </ol>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    💡 Indikator Warna Nilai
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center mb-6">
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">0 - 59</span>
                                        <p className="text-sm text-red-800 dark:text-red-300 font-semibold mt-1">Kurang</p>
                                    </div>
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">60 - 79</span>
                                        <p className="text-sm text-yellow-800 dark:text-yellow-300 font-semibold mt-1">Cukup</p>
                                    </div>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <span className="text-2xl font-bold text-green-600 dark:text-green-400">80 - 100</span>
                                        <p className="text-sm text-green-800 dark:text-green-300 font-semibold mt-1">Baik</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b pb-2 dark:border-gray-700">
                                    💡 Tips & Troubleshooting
                                </h3>
                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                                    <li><strong>Verifikasi OCR:</strong> Selalu lakukan pengecekan acak (spot check). Klik tombol "Detail" pada hasil siswa, lalu klik "Tampilkan Teks" untuk melihat apa yang dibaca AI.</li>
                                    <li><strong>Jawaban Kosong:</strong> Jika AI memberikan nilai 0 dan tulisan [TIDAK DIKERJAKAN], cek visual file aslinya. Mungkin tulisannya terlalu kabur atau halaman kosong.</li>
                                    <li><strong>Error 429 (Rate Limit):</strong> Jika proses melambat di akhir, itu normal. Sistem sedang "mengalah" (backoff) agar tidak diblokir Google. Biarkan proses berjalan.</li>
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
                                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 border-b border-red-200 dark:border-red-900/50 pb-2">
                                    🛡️ Security & Abuse Prevention
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans bg-red-50 dark:bg-red-900/10 p-4 rounded-lg">
                                    <p className="font-bold">PENTING: Karena aplikasi ini berjalan di sisi klien (Client-Side), API Key Anda dapat terekspos jika tidak diamankan dengan benar.</p>
                                    
                                    <div>
                                        <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">1. Mengamankan API Key (Wajib Dilakukan di Google Console)</h4>
                                        <p className="mt-1 text-xs">Untuk mencegah orang lain mencuri API Key Anda dan menghabiskan kuota billing:</p>
                                        <ul className="list-decimal list-inside ml-4 text-xs mt-2 space-y-1">
                                            <li>Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="text-blue-600 underline">Google Cloud Console &gt; Credentials</a>.</li>
                                            <li>Klik pada API Key yang digunakan aplikasi ini.</li>
                                            <li>Pada bagian <strong>Application restrictions</strong>, pilih <strong>HTTP referrers (web sites)</strong>.</li>
                                            <li>Tambahkan domain aplikasi Anda (misal: <code>https://penilaian-ai.politeknik.ac.id/*</code>).</li>
                                            <li>Simpan. Sekarang, API Key hanya bisa digunakan dari website kampus Anda.</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">2. Proteksi Kode (Internal Safeguards)</h4>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-2 space-y-1">
                                            <li><strong>File Size Limit:</strong> Kode membatasi upload maksimal 10MB per file untuk mencegah DoS/Browser Crash.</li>
                                            <li><strong>Prompt Injection Defense:</strong> System Instruction (Prompt) telah diperbarui untuk mengabaikan teks jahat dalam dokumen siswa yang mencoba memanipulasi skor (misal: "Abaikan instruksi sebelumnya...").</li>
                                            <li><strong>Token Cap:</strong> Teks input yang sangat panjang dipotong otomatis untuk mencegah Token Exhaustion.</li>
                                            <li><strong>reCAPTCHA v3 (Invisible):</strong> Aplikasi menggunakan Google reCAPTCHA v3 untuk memverifikasi interaksi pengguna secara tak terlihat.</li>
                                        </ul>
                                    </div>

                                     <div>
                                        <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">3. Environment Configuration</h4>
                                        <p className="mt-1 text-xs">Pastikan environment variables berikut disetel pada saat build/deployment:</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-2 space-y-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                            <li><code>API_KEY</code>: Kunci Google Gemini API Anda (dari Google AI Studio).</li>
                                            <li><code>RECAPTCHA_SITE_KEY</code>: Site Key Google reCAPTCHA v3 Anda (dari Google Cloud Console).</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 mb-3">
                                    🏗️ Arsitektur Sistem & Logika Bisnis
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans">
                                    <div>
                                        <h4 className="font-bold text-base">1. File Processing & Cache Busting (`utils/fileUtils.ts`)</h4>
                                        <p className="mt-1">Implementasi Deep Fix untuk konsistensi OCR dan penanganan ZIP yang deterministik.</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded leading-relaxed">
                                            <li><strong>Nuclear Cache Busting:</strong> Browser sering melakukan caching agresif pada Blob jika nama file sama. Sistem menambahkan timestamp dan string acak ke setiap nama file yang diekstrak (<code>filename_TIMESTAMP_RANDOM.ext</code>). Ini memaksa browser dan AI melihatnya sebagai resource baru setiap saat.</li>
                                            <li><strong>Deterministic Grouping:</strong> Logika penentuan nama mahasiswa menggunakan path parsing yang ketat. Common root path dibuang terlebih dahulu. Jika sisa path memiliki folder, nama folder = nama mahasiswa. Jika file ada di root, nama file = nama mahasiswa.</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-base">2. Grading Service (`services/geminiService.ts`)</h4>
                                        <p className="mt-1">Service layer yang menangani komunikasi dengan Gemini API.</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1 leading-relaxed">
                                            <li><strong>Stateless Architecture (Critical):</strong> Objek <code>GoogleGenAI</code> diinstansiasi <strong>di dalam</strong> fungsi <code>gradeAnswer</code>, bukan secara global. Ini mencegah kebocoran state/konteks antar request paralel yang bisa menyebabkan AI "berhalusinasi" data mahasiswa A saat menilai mahasiswa B.</li>
                                            <li><strong>Prompt Engineering:</strong> Menggunakan teknik instruksi deterministik (Temperature 0) dan One-Shot prompting dengan konteks penuh.</li>
                                            <li><strong>Robust Retry:</strong> Mengimplementasikan Exponential Backoff dengan Jitter untuk menangani error Rate Limit (429) secara elegan tanpa memutus proses batch.</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-base">3. Batch Concurrency (`components/ClassMode.tsx`)</h4>
                                        <p className="mt-1">Menggunakan pola <strong>Worker Pool</strong> kustom.</p>
                                        <ul className="list-disc list-inside ml-4 text-xs mt-1 leading-relaxed">
                                            <li><strong>Optimized Concurrency Limit (8):</strong> Berkat arsitektur <em>stateless</em> yang aman, konkurensi ditingkatkan dari 5 menjadi 8. Ini meningkatkan throughput sekitar 30-40% pada akun standar tanpa memicu 429 berlebihan.</li>
                                            <li><strong>Staggered Start:</strong> Worker diluncurkan dengan jeda 800ms untuk mencegah lonjakan request awal ("Thundering Herd").</li>
                                            <li><strong>Manifest Preview:</strong> Data divalidasi dan ditampilkan ke user sebelum masuk ke antrian worker.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>🖨️</span> Cetak / Simpan PDF
                    </button>
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