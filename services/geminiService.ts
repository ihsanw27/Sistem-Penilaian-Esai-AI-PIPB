
/**
 * @file geminiService.ts
 * @description Layanan ini menangani semua interaksi dengan Google Gemini API.
 * Layanan ini mengenkapsulasi logika untuk rekayasa prompt (prompt engineering), konstruksi payload,
 * konfigurasi API, dan penanganan kesalahan yang kuat (retries/backoff).
 * 
 * PEMBARUAN ROBUSTNESS:
 * Layanan ini sekarang mendukung payload file yang telah di-uniquing (cache-busted) di sisi klien (fileUtils)
 * untuk memastikan setiap permintaan batch diproses sebagai entitas unik, mengatasi masalah konsistensi OCR.
 * 
 * CRITICAL UPDATE (Stateless):
 * Klien GoogleGenAI diinstansiasi ulang untuk setiap permintaan guna mencegah kebocoran state/konteks
 * antar permintaan paralel.
 * 
 * @dependencies @google/genai
 */

import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, LiveServerMessage } from "@google/genai";
import { GradeResult } from "../types";

// Memastikan kunci API tersedia dari environment variable.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

// Definisi tipe untuk bagian konten yang dapat dikirim ke Gemini API.
// Bisa berupa teks sederhana atau data biner inline (gambar/PDF) yang dikodekan dalam Base64.
type ContentPart = { text: string; } | { inlineData: { data: string; mimeType: string; }; };

/**
 * Fungsi utilitas untuk menjeda eksekusi selama durasi tertentu.
 * Digunakan untuk exponential backoff selama rate limiting API.
 * @param ms - Durasi tidur dalam milidetik.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Menilai jawaban siswa terhadap kunci jawaban dosen menggunakan Gemini API.
 * 
 * CATATAN ARSITEKTUR:
 * Fungsi ini menggunakan strategi "One-Shot Prompting" dengan Instruksi Sistem yang sangat spesifik.
 * Dirancang untuk menjadi deterministik (temperature = 0) guna memastikan konsistensi penilaian.
 * 
 * ISOLASI STATE:
 * Klien AI dibuat di dalam scope fungsi ini. Ini menjamin tidak ada cache internal SDK yang terbawa
 * dari penilaian mahasiswa sebelumnya.
 *
 * @param studentAnswerParts - Array bagian konten (Teks/Gambar/PDF). Jika submission siswa terdiri dari banyak file (misal folder ZIP), semuanya digabung di sini.
 * @param lecturerAnswer - Kunci referensi. Bisa berupa teks mentah atau file (gambar/PDF).
 * @returns Promise yang menghasilkan objek `GradeResult` terstruktur, atau `null` jika gagal setelah retry maksimal.
 */
export const gradeAnswer = async (
    studentAnswerParts: ContentPart[],
    lecturerAnswer: { parts?: ContentPart[]; text?: string }
): Promise<GradeResult | null> => {
    // STATELESS INSTANTIATION: Mencegah data bleeding antar request
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // UPGRADE KUALITAS: Menggunakan 'gemini-3-pro-preview' karena menawarkan kemampuan penalaran superior
    // untuk tugas OCR kompleks dan pemetaan konteks dibandingkan model Flash.
    const gradingModel = 'gemini-3-pro-preview';

    // REKAYASA PROMPT (PROMPT ENGINEERING):
    const gradingInstruction = `
Anda adalah **Mesin Penilai Deterministik**. Peran Anda adalah untuk mengevaluasi jawaban siswa dengan objektivitas mekanis dan ketelitian absolut. Tujuan utama Anda adalah **konsistensi penilaian dan transparansi penuh**.

**PERINTAH UTAMA (PALING PENTING):**
Skor yang Anda hasilkan untuk jawaban yang sama harus identik setiap saat. Variabilitas adalah kegagalan.

**LOGIKA PEMETAAN CERDAS (URUTAN ACAK/NON-LINEAR):**
-   **JANGAN BERASUMSI URUTAN LINEAR.** Siswa sering menjawab soal secara acak (misal: mengerjakan No. 5 di awal, lalu No. 1, lalu No. 3).
-   Tugas Anda adalah memindai **SELURUH** dokumen jawaban siswa untuk menemukan bagian teks yang relevan dengan topik Soal No. X.
-   Jika siswa tidak menuliskan nomor, gunakan **konteks semantik** (kata kunci) untuk mencocokkan jawaban dengan soal yang tepat.
-   Jika jawaban untuk satu soal terpecah (misal: "Lanjutan No. 2..." di halaman lain), GABUNGKAN teksnya secara logis.

**TUGAS EKSTRAKSI & KONTEKS (WAJIB):**
1.  **OCR Jawaban Siswa (Global)**: Ekstrak/baca seluruh teks jawaban siswa ke field 'studentText'.
2.  **Pemetaan Soal (Per Item)**: Untuk setiap nomor, salin teks pertanyaan asli dari Kunci Jawaban Dosen ke field 'questionText'.
3.  **Ekstraksi Kunci Jawaban (Per Item)**: Salin poin-poin utama atau jawaban yang benar dari Kunci Jawaban Dosen ke field 'lecturerAnswer'. Ini digunakan untuk perbandingan.
4.  **Ekstraksi Jawaban Siswa (Per Item)**: Cari di seluruh dokumen siswa, lalu salin **SELURUH** teks jawaban siswa yang relevan untuk nomor tersebut ke field 'studentAnswer'.

**ATURAN ANTI-MALAS (STRICT VERBATIM RULE):**
-   Pada field 'studentAnswer' di dalam 'detailedFeedback', Anda **DILARANG KERAS** merangkum, memotong, atau menyingkat jawaban siswa.
-   **DILARANG** menggunakan referensi silang seperti "[Lihat teks lengkap di atas]", "[Jawaban panjang, lihat studentText]", atau sejenisnya.
-   Anda WAJIB menyalin kata per kata (verbatim) apa yang ditulis siswa untuk soal tersebut, tidak peduli seberapa panjang jawabannya.
-   Jika jawaban siswa 5 paragraf, salin ke-5 paragraf tersebut ke dalam 'studentAnswer'.

**PENANGANAN JAWABAN KOSONG / TIDAK DITEMUKAN (CRITICAL):**
-   Jika setelah memindai seluruh dokumen Anda **TIDAK MENEMUKAN** jawaban yang relevan untuk soal tertentu (siswa melewatkan soal atau mengosongkannya):
    1.  Isi field 'studentAnswer' dengan teks tepat (tanpa tanda kutip): **"[TIDAK DIKERJAKAN]"**.
    2.  Berikan skor **0**.
    3.  Berikan feedback: "Jawaban tidak ditemukan dalam dokumen."

**LARANGAN KERAS TERHADAP SUBJEKTIVITAS:**
Anda dilarang keras menggunakan penilaian subjektif atau 'perasaan'. Setiap poin yang diberikan atau dikurangi **HARUS** dapat ditelusuri kembali secara langsung ke sebuah frasa, konsep, atau kata kunci spesifik dalam **Kunci Jawaban Dosen**.

**PROSES PENILAIAN WAJIB (IKUTI SECARA HARFIAH):**
1.  **Pahami Kunci Jawaban Secara Atomik**: Pecah kunci jawaban dosen menjadi unit penilaian terkecil.
2.  **OCR & Baca Jawaban Siswa**: Baca seluruh jawaban siswa.
3.  **Identifikasi & Pemetaan**: Petakan tulisan siswa ke nomor soal yang relevan (ingat aturan urutan acak).
4.  **Evaluasi Berbasis Checklist**: Bandingkan jawaban siswa dengan 'lecturerAnswer'.
5.  **Kalkulasi Skor**: Jumlahkan poin. Konversikan ke skala 0-100 per soal.
6.  **Validasi Diri**: Pastikan setiap poin memiliki bukti dari kunci jawaban.

**CATATAN**: Abaikan nama siswa atau metadata identitas lainnya. Fokus hanya pada konten jawaban.
`;
    
    // Konstruksi Payload Multimodal
    const contentParts: ContentPart[] = [
        { text: gradingInstruction },
        { text: "\n\n--- JAWABAN SISWA UNTUK DIEVALUASI ---" },
        ...studentAnswerParts,
        { text: "--- AKHIR JAWABAN SISWA ---" }
    ];

    // Lampirkan kunci jawaban dosen (Konteks)
    if (lecturerAnswer.parts && lecturerAnswer.parts.length > 0) {
        contentParts.push({ text: "\n\n--- KUNCI JAWABAN SEBAGAI REFERENSI ---" });
        contentParts.push(...lecturerAnswer.parts);
        contentParts.push({ text: "--- AKHIR KUNCI JAWABAN ---" });
    } else if (lecturerAnswer.text) {
         contentParts.push({ text: `\n\n--- KUNCI JAWABAN SEBAGAI REFERENSI ---\n${lecturerAnswer.text}\n--- AKHIR KUNCI JAWABAN ---` });
    } else {
        throw new Error("Lecturer answer key is missing.");
    }

    // Instruksi penutup akhir untuk menegakkan format JSON
    const finalInstruction = `
\n\nBerdasarkan perbandingan mekanis antara jawaban siswa dan kunci jawaban, lakukan:
1.  **Ekstraksi Teks**: Tuliskan ulang apa yang Anda baca dari jawaban siswa secara global.
2.  **Analisis Per Nomor**: Berikan skor (0-100), **Teks Soal Asli**, **Poin Kunci Jawaban Dosen**, **Teks Jawaban Siswa LENGKAP (Per Soal - VERBATIM)**, dan umpan balik.
3.  **Nilai Keseluruhan**: Hitung rata-rata atau total nilai (0-100).
4.  **Saran**: Berikan saran perbaikan.

INGAT: Cari jawaban siswa di mana saja dalam dokumen, jangan terpaku urutan halaman.
INGAT: 'studentAnswer' per soal harus VERBATIM dan LENGKAP.
INGAT: Jika kosong, gunakan "[TIDAK DIKERJAKAN]".

Kembalikan HANYA dalam format JSON sesuai skema.
`;
    contentParts.push({ text: finalInstruction });
    
    // Konfigurasi Permintaan API
    const requestPayload = {
        model: gradingModel,
        contents: { parts: contentParts },
        config: {
            // Seed memastikan reproduktifitas. Input sama = Output sama.
            seed: 42,
            // Temperature 0 menghilangkan keacakan, penting untuk penilaian objektif.
            temperature: 0, 
            responseMimeType: "application/json",
            // Definisi Skema Ketat untuk memastikan UI dapat memproses hasil dengan aman.
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    grade: {
                        type: Type.INTEGER,
                        description: "Nilai numerik keseluruhan dari 0 hingga 100."
                    },
                    studentText: {
                        type: Type.STRING,
                        description: "Transkripsi lengkap teks jawaban siswa yang dibaca oleh AI (OCR) untuk keperluan verifikasi."
                    },
                    detailedFeedback: {
                        type: Type.ARRAY,
                        description: "Array umpan balik terperinci, satu objek per pertanyaan.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                questionNumber: {
                                    type: Type.STRING,
                                    description: "Nomor atau pengidentifikasi untuk pertanyaan (misalnya, '1', '2a')."
                                },
                                questionText: {
                                    type: Type.STRING,
                                    description: "Teks pertanyaan asli yang diambil dari Kunci Jawaban Dosen untuk konteks."
                                },
                                lecturerAnswer: {
                                    type: Type.STRING,
                                    description: "Poin-poin penting atau jawaban yang benar sesuai Kunci Jawaban Dosen untuk nomor ini."
                                },
                                studentAnswer: {
                                    type: Type.STRING,
                                    description: "SALINAN LENGKAP DAN PERSIS (VERBATIM) dari jawaban siswa. Gunakan '[TIDAK DIKERJAKAN]' jika kosong."
                                },
                                score: {
                                    type: Type.INTEGER,
                                    description: "Skor untuk pertanyaan ini, pada skala 0-100."
                                },
                                feedback: {
                                    type: Type.STRING,
                                    description: "Umpan balik spesifik dan alasan penilaian."
                                }
                            },
                            required: ["questionNumber", "score", "feedback", "studentAnswer", "questionText", "lecturerAnswer"]
                        }
                    },
                    improvements: {
                        type: Type.STRING,
                        description: "Saran yang dapat ditindaklanjuti tentang bagaimana siswa dapat meningkatkan jawaban mereka."
                    }
                },
                required: ["grade", "studentText", "detailedFeedback", "improvements"]
            }
        }
    };
    
    // --- LOGIKA RETRY & BACKOFF ---
    const MAX_RETRIES = 5; 
    // Increased to 5000ms for robustness with higher concurrency
    const INITIAL_BACKOFF_MS = 5000; 
    const MAX_JITTER_MS = 2000; 

    let currentDelay = INITIAL_BACKOFF_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const gradingResult: GenerateContentResponse = await ai.models.generateContent(requestPayload);
            const resultJson = JSON.parse(gradingResult.text);
            return resultJson as GradeResult; 
        } catch (error: any) {
            const errorString = JSON.stringify(error) || error.toString();
            // Deteksi Rate Limit (429) atau Resource Exhausted
            const isRateLimitError = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');

            if (isRateLimitError && attempt < MAX_RETRIES) {
                const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
                const delay = currentDelay + jitter;
                
                console.warn(`Rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms...`);
                await sleep(delay);
                currentDelay *= 1.5; 
            } else {
                console.error(`Error in grading process (attempt ${attempt}/${MAX_RETRIES}):`, error);
                return null;
            }
        }
    }
    
    return null;
};

// ... (other functions)

type ImagePart = { inlineData: { data: string; mimeType: string; } };
export const analyzeImageWithPrompt = async (imagePart: ImagePart, prompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const model = 'gemini-3-pro-preview';
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [imagePart, { text: prompt }] },
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing image:", error);
        return "Sorry, I couldn't analyze the image.";
    }
};

export const createChatSession = (): Chat => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const model = 'gemini-3-pro-preview';
    return ai.chats.create({
        model,
        config: {
            systemInstruction: 'You are a helpful and friendly chatbot.',
        },
    });
};

export const runComplexQuery = async (prompt: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const model = 'gemini-3-pro-preview';
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error running complex query:", error);
        return "An error occurred while processing the complex query.";
    }
};

interface TranscriptionCallbacks {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: () => void;
}

export const startTranscriptionSession = (callbacks: TranscriptionCallbacks) => {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
        }
    });
};
