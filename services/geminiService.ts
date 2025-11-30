import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality, LiveServerMessage } from "@google/genai";
import { GradeResult } from "../types";

// Ensure the API key is available.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

// Initialize the GoogleGenAI client.
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Type definition for the content parts that can be sent to the Gemini API.
type ContentPart = { text: string; } | { inlineData: { data: string; mimeType: string; }; };

// FIX: Add a sleep utility for exponential backoff.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Grades a student's answer against a lecturer's answer key using the Gemini API.
 * This function orchestrates a detailed prompt engineering strategy to ensure consistent,
 * deterministic, and objective grading. It now includes a retry mechanism with exponential 
 * backoff to handle API rate limiting (429 errors).
 *
 * @param studentAnswerParts - An array of content parts representing the student's submission (text and/or images).
 * @param lecturerAnswer - An object containing the lecturer's answer key, either as content parts or plain text.
 * @returns A promise that resolves to a structured `GradeResult` object, or `null` if an error occurs.
 */
export const gradeAnswer = async (
    studentAnswerParts: ContentPart[],
    lecturerAnswer: { parts?: ContentPart[]; text?: string }
): Promise<GradeResult | null> => {
    // QUALITY UPGRADE: Switched to gemini-3-pro-preview for state-of-the-art reasoning 
    // and complex task handling, ensuring maximum grading accuracy.
    const gradingModel = 'gemini-3-pro-preview';

    // CONSISTENCY ENHANCEMENT V10: Added Robust Mapping for Random Order and Strict Verbatim Rules.
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
    
    // Assemble the content parts for the API call, starting with the main instruction.
    const contentParts: ContentPart[] = [
        { text: gradingInstruction },
        { text: "\n\n--- JAWABAN SISWA UNTUK DIEVALUASI ---" },
        ...studentAnswerParts,
        { text: "--- AKHIR JAWABAN SISWA ---" }
    ];

    // Append the lecturer's answer key to the content parts.
    if (lecturerAnswer.parts && lecturerAnswer.parts.length > 0) {
        contentParts.push({ text: "\n\n--- KUNCI JAWABAN SEBAGAI REFERENSI ---" });
        contentParts.push(...lecturerAnswer.parts);
        contentParts.push({ text: "--- AKHIR KUNCI JAWABAN ---" });
    } else if (lecturerAnswer.text) {
         contentParts.push({ text: `\n\n--- KUNCI JAWABAN SEBAGAI REFERENSI ---\n${lecturerAnswer.text}\n--- AKHIR KUNCI JAWABAN ---` });
    } else {
        throw new Error("Lecturer answer key is missing.");
    }

    // Final instruction telling the model what to do and how to format the output.
    const finalInstruction = `
\n\nBerdasarkan perbandingan mekanis antara jawaban siswa dan kunci jawaban, lakukan:
1.  **Ekstraksi Teks**: Tuliskan ulang apa yang Anda baca dari jawaban siswa secara global.
2.  **Analisis Per Nomor**: Berikan skor (0-100), **Teks Soal Asli**, **Poin Kunci Jawaban Dosen**, **Teks Jawaban Siswa LENGKAP (Per Soal - VERBATIM)**, dan umpan balik.
3.  **Nilai Keseluruhan**: Hitung rata-rata atau total nilai (0-100).
4.  **Saran**: Berikan saran perbaikan.

INGAT: Cari jawaban siswa di mana saja dalam dokumen, jangan terpaku urutan halaman.
INGAT: 'studentAnswer' per soal harus VERBATIM dan LENGKAP.

Kembalikan HANYA dalam format JSON sesuai skema.
`;
    contentParts.push({ text: finalInstruction });
    
    // Create the request payload outside the loop.
    const requestPayload = {
        model: gradingModel,
        contents: { parts: contentParts },
        config: {
            // NOTE: Thinking Config is not supported in gemini-3-pro-preview.
            // Using standard generation with temperature 0 for determinism.
            seed: 42,
            temperature: 0, 
            responseMimeType: "application/json",
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
                                    description: "SALINAN LENGKAP DAN PERSIS (VERBATIM) dari jawaban siswa yang relevan untuk soal ini (dicari dari seluruh dokumen). JANGAN MENYINGKAT."
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
    
    // --- Retry Logic ---
    // Increased retry limits and backoff duration to safely handle rate limits without failure.
    // 5 attempts allows the system to wait out most 429 windows.
    const MAX_RETRIES = 5; 
    const INITIAL_BACKOFF_MS = 5000; // Increased to 5s to be more patient
    const MAX_JITTER_MS = 2000; // Jitter up to 2s

    let currentDelay = INITIAL_BACKOFF_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const gradingResult: GenerateContentResponse = await ai.models.generateContent(requestPayload);
            const resultJson = JSON.parse(gradingResult.text);
            return resultJson as GradeResult; // Success
        } catch (error: any) {
            const errorString = JSON.stringify(error) || error.toString();
            const isRateLimitError = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');

            if (isRateLimitError && attempt < MAX_RETRIES) {
                // Add Jitter: Random variation to prevent Thundering Herd problem
                const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
                const delay = currentDelay + jitter;
                
                console.warn(`Rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms...`);
                await sleep(delay);
                
                // Exponential backoff for the base delay
                currentDelay *= 1.5; // Slightly gentler multiplier to avoid extreme waits
            } else {
                console.error(`Error in grading process (attempt ${attempt}/${MAX_RETRIES}):`, error);
                return null; // Final attempt failed or a non-retriable error occurred.
            }
        }
    }
    
    return null; // Should only be reached if something unexpected happens with the loop.
};

// FIX: Add analyzeImageWithPrompt function for ImageAnalyzer component.
type ImagePart = { inlineData: { data: string; mimeType: string; } };
/**
 * Analyzes an image with a given text prompt using a multimodal model.
 * @param imagePart - The image to analyze, as a base64 encoded string with its MIME type.
 * @param prompt - The text prompt to guide the analysis.
 * @returns A promise that resolves to the model's text response.
 */
export const analyzeImageWithPrompt = async (imagePart: ImagePart, prompt: string): Promise<string> => {
    try {
        // Upgrade to Gemini 3 Pro for better multimodal understanding
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

// FIX: Add createChatSession function for ChatBot component.
/**
 * Creates and returns a new chat session with the Gemini API.
 * The session is initialized with a system instruction for the model.
 * @returns A `Chat` object for interactive conversations.
 */
export const createChatSession = (): Chat => {
    // Upgrade to Gemini 3 Pro for smarter conversational abilities
    const model = 'gemini-3-pro-preview';
    return ai.chats.create({
        model,
        // The config is the same as the models.generateContent config.
        config: {
            systemInstruction: 'You are a helpful and friendly chatbot.',
        },
    });
};

// FIX: Add runComplexQuery function for ThinkingMode component.
/**
 * Runs a complex query using a powerful model.
 * @param prompt - The complex prompt or question to send to the model.
 * @returns A promise that resolves to the model's detailed text response.
 */
export const runComplexQuery = async (prompt: string): Promise<string> => {
    try {
        // Upgrade to Gemini 3 Pro.
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


// FIX: Add startTranscriptionSession function for AudioTranscriber component.
/**
 * Interface for the callbacks required by the live transcription session.
 */
interface TranscriptionCallbacks {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: () => void;
}

/**
 * Initiates a live, real-time transcription session with the Gemini Live API.
 * @param callbacks - An object containing callback functions to handle session events (open, message, error, close).
 * @returns A promise that resolves to the live session object.
 */
export const startTranscriptionSession = (callbacks: TranscriptionCallbacks) => {
    // Keep using the specialized audio preview model for live sessions
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            // Even if we only want transcription, AUDIO modality is required for the response.
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
        }
    });
};