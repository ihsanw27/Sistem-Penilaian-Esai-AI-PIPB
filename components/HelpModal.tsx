
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, UploadIcon, CheckIcon, DownloadIcon, SettingsIcon } from './icons';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void; // Prop baru untuk membuka pengaturan dari help
}

/**
 * @component HelpModal
 * @description Modal komprehensif yang menampilkan panduan penggunaan aplikasi dan dokumentasi teknis.
 * Menggunakan React Portal untuk rendering di top-level document body.
 * 
 * UPDATE v1.6:
 * - Dokumentasi disesuaikan dengan konfigurasi default baru: Gemini 3 Pro + Concurrency 2.
 * - Penjelasan fitur "Opsi Lanjutan" untuk pengaturan konkurensi.
 * - Penjelasan detail tentang trade-off Kecepatan vs Kecerdasan.
 */
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onOpenSettings }) => {
    const [activeTab, setActiveTab] = useState<'user' | 'dev'>('user');

    if (!isOpen) return null;

    /**
     * Menangani pencetakan konten bantuan.
     */
    const handlePrint = () => {
        const printContent = document.getElementById('help-content-area');
        if (!printContent) return;

        const win = window.open('', '', 'height=700,width=1000');
        if (!win) return;

        win.document.write('<html><head><title>Panduan Sistem Penilaian AI PIPB</title>');
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
        
        setTimeout(() => {
            win.print();
        }, 500);
    };

    return createPortal(
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
                                    Sistem Penilaian Esai AI PIPB adalah platform cerdas yang dirancang untuk membantu dosen Politeknik Industri Petrokimia Banten dalam menilai jawaban mahasiswa secara objektif, cepat, dan transparan. Menggunakan model <strong>Google Gemini</strong>, sistem ini mampu membaca berbagai format dokumen (PDF, Word, Gambar, Tulis Tangan) dan membandingkannya dengan kunci jawaban Dosen secara verbatim (kata per kata).
                                </p>
                            </section>

                            {/* PENGATURAN API KEY & MODEL (NEW SECTION) */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <span className="text-xl">⚙️</span> Konfigurasi Model & Performa
                                </h3>
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm space-y-4">
                                    
                                    {/* Pemilihan Model */}
                                    <div>
                                        <h4 className="font-bold text-sm text-blue-700 dark:text-blue-400 mb-2">1. Memilih Model (Kecerdasan vs Kecepatan)</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                            Aplikasi ini diatur secara default ke <strong>Gemini 3 Pro</strong> dengan kecepatan rendah agar aman digunakan secara gratis. Anda dapat mengubahnya di menu Pengaturan:
                                        </p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                                <strong className="block text-sm text-blue-800 dark:text-blue-300">🧠 Gemini 3 Pro (Default)</strong>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                    <strong>Karakteristik:</strong> Sangat Cerdas & Peka Nuansa.
                                                    <br/><strong>Kondisi:</strong> Diatur berjalan lambat (2 mahasiswa sekaligus) agar tidak sering error pada akun gratis. Cocok untuk akurasi tinggi.
                                                </p>
                                            </div>
                                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-800">
                                                <strong className="block text-sm text-green-800 dark:text-green-300">⚡ Gemini 2.5 Flash</strong>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                    <strong>Karakteristik:</strong> Seimbang & Cepat.
                                                    <br/><strong>Kondisi:</strong> Bisa menilai hingga 5-8 mahasiswa sekaligus. Gunakan ini jika Anda merasa Gemini 3 Pro terlalu lambat untuk menilai kelas besar.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BYOK Guide */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <h4 className="font-bold text-sm text-purple-700 dark:text-purple-400 mb-2">2. Gunakan API Key Sendiri (BYOK)</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                            Agar tidak berebut kuota server dengan dosen lain, sangat disarankan memasukkan API Key Google pribadi Anda (Gratis).
                                        </p>
                                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs space-y-2">
                                            <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 font-medium">
                                                <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 underline">Google AI Studio</a> & login akun Google.</li>
                                                <li>Klik <strong>"Create API Key"</strong>.</li>
                                                <li>Salin kode (contoh: <code>AIzaSyB...</code>).</li>
                                                <li>Kembali ke aplikasi ini, klik tombol <strong>Pengaturan (⚙️)</strong> di pojok kanan atas.</li>
                                                <li>Tempel kunci di kolom "Gemini API Key" dan simpan.</li>
                                            </ol>
                                        </div>
                                    </div>

                                    {/* Advanced Settings Guide */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <h4 className="font-bold text-sm text-orange-700 dark:text-orange-400 mb-2">3. Pengaturan Lanjutan (Advanced)</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Di menu Pengaturan, terdapat opsi tersembunyi <strong>"Opsi Lanjutan"</strong>. Di sini Anda dapat mengubah jumlah <em>Konkurensi</em> (jumlah file yang diproses bersamaan). 
                                            <br/><br/>
                                            <strong>⚠️ Peringatan:</strong> Jangan naikkan angka di atas 2 jika Anda tidak memiliki API Key berbayar, karena akan menyebabkan error "429 Too Many Requests".
                                        </p>
                                    </div>

                                    {onOpenSettings && (
                                        <button 
                                            onClick={onOpenSettings}
                                            className="w-full mt-2 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-gray-300 dark:border-gray-600"
                                        >
                                            <SettingsIcon className="w-4 h-4" />
                                            Buka Menu Pengaturan Sekarang
                                        </button>
                                    )}
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
                                            Saat Anda mengunggah ZIP, sistem secara otomatis mendeteksi strukturnya. Folder diubah menjadi identitas mahasiswa. Sistem juga menerapkan <em>Cache Busting</em> untuk memastikan setiap file dibaca sebagai entitas unik.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        <h4 className="font-bold text-indigo-800 dark:text-indigo-300 mb-2">2. Analisis Konteks (NLP)</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            AI membaca seluruh dokumen sekaligus. Ia tidak memerlukan jawaban berurutan. AI akan mencari paragraf yang relevan dengan soal nomor tertentu di mana pun letaknya dalam dokumen.
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
                                        <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">3. Penilaian Objektif & Mekanis</h4>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                            Meskipun AI berperan sebagai "Asisten Dosen" yang sopan, logika penilaiannya dikunci pada <strong>Suhu (Temperature) 0</strong>. Ini berarti AI dilarang "berimajinasi". Ia hanya menilai berdasarkan fakta.
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
                                            <strong className="text-gray-900 dark:text-gray-100">Mulai Penilaian:</strong> Klik tombol "Mulai Penilaian AI".
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
                                                </ul>
                                            </div>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Verifikasi (Manifest Preview):</strong> <span className="text-green-600 dark:text-green-400 font-bold">[PENTING]</span> Setelah unggah, klik tombol "Lihat Daftar Mahasiswa". Pastikan jumlah mahasiswa dan filenya sesuai.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Langkah 2 (Upload Kunci):</strong> Unggah kunci jawaban Dosen.
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Eksekusi:</strong> Klik "Mulai Penilaian AI". 
                                            <span className="block mt-1 text-xs text-blue-600 dark:text-blue-400 italic">
                                                Catatan: Dengan model default (Gemini 3 Pro), proses akan berjalan dengan kecepatan <strong>2 mahasiswa per menit</strong> untuk keamanan kuota. Mohon bersabar atau ganti model ke Flash di Pengaturan.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-900 dark:text-gray-100">Selesai:</strong> Unduh Excel laporan.
                                        </li>
                                    </ol>
                                </div>
                            </section>

                            {/* Lingkungan Sistem & Performa */}
                            <section>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 border-b pb-2 dark:border-gray-700">
                                    💻 Lingkungan Sistem & Performa
                                </h3>
                                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                    <p>
                                        Aplikasi ini berjalan secara <strong>Hybrid (Client-Side + Cloud)</strong>. Performa sangat bergantung pada:
                                    </p>
                                    <ul className="list-disc list-inside ml-4 space-y-2">
                                        <li>
                                            <strong>Koneksi Internet (Upload):</strong> Kecepatan unggah file mahasiswa ke Google Cloud sangat menentukan seberapa cepat proses dimulai.
                                        </li>
                                        <li>
                                            <strong>Spesifikasi Komputer (RAM/CPU):</strong> Proses ekstraksi ZIP dan pembuatan laporan Excel dilakukan di browser Anda. Komputer dengan RAM &lt; 4GB mungkin mengalami lag saat memproses ratusan file.
                                        </li>
                                        <li>
                                            <strong>Jenis Akun Google AI:</strong> Akun gratis memiliki batas kecepatan (Rate Limit) yang ketat. Akun berbayar (Pay-as-you-go) bisa berjalan jauh lebih cepat dengan menaikkan <em>Concurrency</em> di pengaturan.
                                        </li>
                                    </ul>
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
                                    <li>AI SDK: @google/genai (Gemini 3 Pro / 2 Flash)</li>
                                    <li>State: React Hooks + LocalStorage Persistence</li>
                                </ul>
                            </div>

                            <section>
                                <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-3">
                                    ⚙️ Configuration Architecture
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans">
                                    <div>
                                        <h4 className="font-bold text-base">Priority-Based Config (`geminiService.ts`)</h4>
                                        <p className="mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded leading-relaxed">
                                            Sistem menggunakan logika <em>fallback</em> untuk API Key dan Model:
                                            <br/>1. <strong>LocalStorage (`USER_GEMINI_API_KEY`)</strong>: Jika ada, ini yang dipakai (BYOK).
                                            <br/>2. <strong>Environment Variable (`process.env.API_KEY`)</strong>: Jika user tidak set key sendiri, pakai key server default.
                                            <br/>
                                            Hal yang sama berlaku untuk model. Default sekarang dikembalikan ke <strong>Gemini 3 Pro</strong> demi akurasi.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-base">Rate Limit & Concurrency Strategy</h4>
                                        <p className="mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded leading-relaxed">
                                            <strong>Default Concurrency: 2</strong>. 
                                            <br/>
                                            Angka ini dipilih sebagai <em>"Magic Number"</em> untuk Gemini 3 Pro pada Free Tier. Free Tier biasanya memiliki limit ~2 RPM (Requests Per Minute) untuk model Pro. Dengan worker 2, sistem mengirim request, menunggu proses (~30 detik), lalu mengirim lagi, sehingga secara alami mematuhi limit tersebut tanpa sering terkena error 429.
                                            <br/><br/>
                                            Jika user menggunakan Gemini Flash atau API Key berbayar, mereka dapat menaikkan angka ini melalui menu "Opsi Lanjutan".
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400 mb-3">
                                    🏗️ System Architecture
                                </h3>
                                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-sans">
                                    <div>
                                        <h4 className="font-bold text-base">1. Stateless Service Layer</h4>
                                        <p className="mt-1 text-xs leading-relaxed">
                                            Objek <code>GoogleGenAI</code> diinstansiasi baru di setiap pemanggilan fungsi <code>gradeAnswer</code>. Ini mencegah <em>data bleeding</em> (kebocoran konteks) antar penilaian siswa yang berbeda saat berjalan paralel.
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-base">2. Deterministic File Processing</h4>
                                        <p className="mt-1 text-xs leading-relaxed">
                                            Logika ZIP di <code>fileUtils.ts</code> menggunakan strategi deterministik:
                                            <br/>- <strong>Folder Grouping:</strong> Jika ZIP berisi folder, nama folder = ID Mahasiswa.
                                            <br/>- <strong>Flat Files:</strong> Jika ZIP berisi file di root, nama file (minus ekstensi) = ID Mahasiswa.
                                            <br/>- <strong>Clean Visualization:</strong> Kode unik internal (cache buster) dihapus saat ditampilkan di UI Preview agar mudah dibaca manusia.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 border-b border-red-200 dark:border-red-900/50 pb-2">
                                    🛡️ Security (Client-Side)
                                </h3>
                                <div className="space-y-2 text-gray-700 dark:text-gray-300 font-sans text-xs">
                                    <p>Karena aplikasi ini berjalan di browser (tanpa backend proxy):</p>
                                    <ul className="list-disc list-inside ml-4 space-y-1">
                                        <li><strong>API Key Exposure:</strong> Jika menggunakan default env key, amankan via HTTP Referrer restrictions di Google Cloud Console.</li>
                                        <li><strong>File Validation:</strong> Validasi ukuran (10MB) dan tipe file dilakukan di sisi klien sebelum upload.</li>
                                        <li><strong>Prompt Injection:</strong> System Prompt memuat instruksi defensif untuk mengabaikan teks manipulatif dari dokumen siswa.</li>
                                    </ul>
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
        </div>,
        document.body
    );
};

export default HelpModal;
