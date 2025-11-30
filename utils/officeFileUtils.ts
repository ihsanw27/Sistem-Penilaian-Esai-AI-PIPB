
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';

/**
 * Reads a File object and returns its content as an ArrayBuffer.
 * @param file - The file to read.
 * @returns A promise that resolves with the file's ArrayBuffer.
 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Extracts raw text content from a .docx file.
 * @param file - The .docx file.
 * @returns A promise that resolves with the extracted text.
 */
const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

/**
 * Extracts text content from all sheets of an .xlsx file.
 * @param file - The .xlsx file.
 * @returns A promise that resolves with the concatenated text from all sheets.
 */
const extractTextFromXlsx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const text = xlsx.utils.sheet_to_txt(worksheet);
        fullText += `Sheet: ${sheetName}\n${text}\n\n`;
    });
    return fullText;
};

/**
 * Extracts text content from all slides of a .pptx file.
 * It does this by unzipping the file and parsing the XML of each slide.
 * @param file - The .pptx file.
 * @returns A promise that resolves with the concatenated text from all slides.
 */
const extractTextFromPptx = async (file: File): Promise<string> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slidePromises: Promise<string>[] = [];
    
    // Find all slide files (e.g., ppt/slides/slide1.xml, slide2.xml).
    zip.folder('ppt/slides')?.forEach((relativePath, file) => {
        if (relativePath.startsWith('slide') && relativePath.endsWith('.xml')) {
            slidePromises.push(file.async('string'));
        }
    });

    const slideXmls = await Promise.all(slidePromises);
    let fullText = '';

    // Regex to extract text from <a:t> tags within the slide XML.
    const textContentRegex = /<a:t.*?>(.*?)<\/a:t>/g;

    slideXmls.forEach((xml, index) => {
        fullText += `--- Slide ${index + 1} ---\n`;
        let match;
        // Use a Set to avoid duplicate text blocks which can be common in PPTX XML.
        const uniqueText = new Set<string>();
        while ((match = textContentRegex.exec(xml)) !== null) {
            uniqueText.add(match[1].trim());
        }
        fullText += Array.from(uniqueText).join('\n') + '\n\n';
    });

    return fullText;
};


/**
 * Main dispatcher function to extract text from various Office file types.
 * It identifies the file type and calls the appropriate extraction function.
 * @param file - The Office file (.docx, .xlsx, .pptx).
 * @returns A promise that resolves with the extracted text. Rejects if the file type is unsupported.
 */
export const extractTextFromOfficeFile = async (file: File): Promise<string> => {
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return extractTextFromDocx(file);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return extractTextFromXlsx(file);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return extractTextFromPptx(file);
    }
    return Promise.reject(new Error('Unsupported Office file type for text extraction.'));
};
