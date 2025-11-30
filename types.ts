
/**
 * Represents the detailed feedback for a single question.
 */
export interface FeedbackDetail {
    /** The identifier for the question (e.g., "1", "2a", "Essay"). */
    questionNumber: string;
    /** The specific text of the question being graded, extracted from the lecturer's key. */
    questionText?: string;
    /** The specific correct answer or grading criteria from the lecturer's key. */
    lecturerAnswer?: string;
    /** The specific text extracted from the student's answer for this question (OCR). */
    studentAnswer?: string;
    /** The score awarded for the question, on a scale of 0-100. */
    score: number;
    /** Constructive feedback text for the student's answer to this question. */
    feedback: string;
}

/**
 * Represents the complete result of a grading operation for a single submission.
 */
export interface GradeResult {
    /** The name of the file being graded, used in class mode. */
    fileName?: string;
    /** The overall final grade, on a scale of 0-100. */
    grade: number;
    /** An array of detailed feedback for each question. */
    detailedFeedback: FeedbackDetail[];
    /** General, actionable suggestions for improvement. */
    improvements: string;
    /** The text extracted or read from the student's submission by the AI (OCR). */
    studentText?: string;
}


/**
 * Enum for the different features available in the application via the NavBar.
 */
export enum AppFeature {
    GradingSystem = 'AI Grading System',
    ImageAnalyzer = 'Image Analyzer',
    ChatBot = 'Chat Bot',
    ThinkingMode = 'Thinking Mode',
    AudioTranscriber = 'Audio Transcription',
}

/**
 * Represents a single message in a chat conversation.
 */
export interface ChatMessage {
    /** The role of the sender, either the 'user' or the 'model'. */
    role: 'user' | 'model';
    /** The text content of the message. */
    text: string;
}
