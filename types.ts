
/**
 * @file types.ts
 * @description Mendefinisikan antarmuka (interface) dan tipe data TypeScript inti yang digunakan di seluruh aplikasi.
 * File ini berfungsi sebagai "Kontrak Data" antara komponen UI dan Layanan AI (Gemini).
 * 
 * @author System
 * @version 1.3.0
 */

/**
 * Merepresentasikan satu entitas pengumpulan jawaban mahasiswa.
 * Dalam Mode Individu, ini biasanya 1 file gabungan.
 * Dalam Mode Kelas, ini bisa berupa 1 file PDF, ATAU kumpulan file (gambar/hal) dari satu folder ZIP.
 */
export interface StudentSubmission {
    /** 
     * ID unik atau Nama Mahasiswa. 
     * Jika dari Folder ZIP: Nama Folder (misal: "Ahmad Junaedi").
     * Jika File Lepas: Nama File (misal: "Budi.pdf").
     */
    name: string;

    /**
     * Daftar file yang terkait dengan mahasiswa ini.
     * AI akan membaca semua file ini sebagai satu kesatuan konteks jawaban.
     */
    files: File[];
}

/**
 * Merepresentasikan detail umpan balik untuk satu pertanyaan spesifik dalam jawaban siswa.
 * Struktur ini dihasilkan oleh AI untuk setiap item soal yang teridentifikasi.
 */
export interface FeedbackDetail {
    /** 
     * Identifier untuk pertanyaan (misalnya, "1", "2a", "Essay"). 
     * AI menyimpulkan ini dari struktur dokumen atau input dosen.
     */
    questionNumber: string;

    /** 
     * Teks spesifik dari pertanyaan yang dinilai.
     * Diekstrak langsung dari file/teks kunci jawaban dosen untuk memberikan konteks pada laporan.
     */
    questionText?: string;

    /** 
     * Jawaban yang benar, standar, atau kriteria penilaian spesifik.
     * Diekstrak dari kunci dosen. Digunakan sebagai 'Ground Truth' untuk penilaian.
     */
    lecturerAnswer?: string;

    /** 
     * Teks spesifik yang diekstrak dari jawaban siswa untuk pertanyaan ini.
     * PENTING: Ini adalah salinan VERBATIM (OCR) dari apa yang ditulis siswa, bukan ringkasan.
     * Digunakan untuk "Triangulasi" (Soal vs Standar vs Jawaban Siswa).
     */
    studentAnswer?: string;

    /** 
     * Skor yang diberikan untuk pertanyaan spesifik ini.
     * Rentang: 0-100.
     */
    score: number;

    /** 
     * Umpan balik konstruktif dan alasan penilaian yang diberikan oleh AI.
     * Menjelaskan mengapa poin dikurangi atau diberikan berdasarkan lecturerAnswer.
     */
    feedback: string;
}

/**
 * Merepresentasikan hasil lengkap dari operasi penilaian untuk satu pengumpulan (satu siswa).
 * Objek ini adalah payload utama yang dikembalikan oleh layanan `gradeAnswer`.
 */
export interface GradeResult {
    /** 
     * Nama file atau Nama Mahasiswa yang dinilai.
     * Identifier utama dalam Mode Kelas (Batch).
     */
    fileName?: string;

    /** 
     * Nilai akhir keseluruhan yang dihitung oleh AI.
     * Rentang: 0-100.
     */
    grade: number;

    /** 
     * Array objek umpan balik terperinci, satu untuk setiap pertanyaan yang ditemukan.
     */
    detailedFeedback: FeedbackDetail[];

    /** 
     * Saran tingkat tinggi yang dapat ditindaklanjuti bagi siswa untuk meningkatkan kinerja mereka.
     */
    improvements: string;

    /** 
     * Transkripsi teks lengkap (raw full-text) dari jawaban siswa.
     * Diekstrak oleh AI (OCR). Digunakan untuk verifikasi manual (sanity check) oleh dosen.
     */
    studentText?: string;
}

/**
 * Enum untuk berbagai fitur yang tersedia dalam aplikasi melalui NavBar.
 * Saat ini, hanya GradingSystem yang sepenuhnya aktif di dasbor utama.
 */
export enum AppFeature {
    GradingSystem = 'AI Grading System',
    ImageAnalyzer = 'Image Analyzer',
    ChatBot = 'Chat Bot',
    ThinkingMode = 'Thinking Mode',
    AudioTranscriber = 'Audio Transcription',
}

/**
 * Merepresentasikan satu pesan dalam percakapan obrolan (untuk fitur ChatBot).
 */
export interface ChatMessage {
    /** Peran pengirim: 'user' (manusia) atau 'model' (AI). */
    role: 'user' | 'model';
    /** Konten teks aktual dari pesan. */
    text: string;
}
